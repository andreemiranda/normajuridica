// lib/news-fetcher.ts
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';

import { NewsItem } from './types';
import { getNewsStore, formatTimeAgo } from './news-store';
import {
  syncNewsSources,
  triggerBackgroundSyncIfNeeded,
  findAndImportNewsItemFromApi,
  resolveSourceNewsSlugsWithApi,
} from './news-sync';
import { extractUnresolvedSourceNewsCandidates, repairAndSanitizeArticleHtml } from './sanitizer';
import { SITE_CONFIG } from './site-config';

export { formatTimeAgo };

let cachedSeedItems: NewsItem[] | null = null;

function getSeedItems(): NewsItem[] {
  if (cachedSeedItems) return cachedSeedItems;
  const candidates = [
    path.join(process.cwd(), 'data', 'seed-news.json'),
    path.join(__dirname, '..', 'data', 'seed-news.json'),
    path.join(__dirname, '..', '..', 'data', 'seed-news.json'),
    path.join('/app/applet', 'data', 'seed-news.json'),
    '/data/seed-news.json',
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        const data = fs.readFileSync(c, 'utf8');
        cachedSeedItems = JSON.parse(data);
        return cachedSeedItems || [];
      }
    } catch {}
  }
  return [];
}

export interface FetchNewsOptions {
  category?: string;
  sourceId?: string;
  searchQuery?: string;
  limit?: number;
  page?: number;
  refresh?: boolean;
}

export interface FetchNewsResult {
  items: NewsItem[];
  total: number;
  isRealTime: boolean;
  fromStore?: boolean;
}

// In-memory quick cache for sub-second repeat requests within the same tick
let inMemoryShortCache: { key: string; result: FetchNewsResult; timestamp: number } | null = null;

export function clearNewsCache() {
  inMemoryShortCache = null;
  cachedSeedItems = null;
}

export async function fetchNews(options: FetchNewsOptions = {}): Promise<FetchNewsResult> {
  const store = getNewsStore();
  await store.init();

  const {
    category,
    sourceId,
    searchQuery,
    limit = 30,
    page = 1,
    refresh = false,
  } = options;

  // If explicit refresh requested, trigger a sync run first
  if (refresh) {
    try {
      await syncNewsSources({ force: true });
      clearNewsCache();
    } catch (err) {
      console.warn('Erro ao forçar sincronização durante refresh:', err);
    }
  }

  const cacheKey = `${category || 'all'}:${sourceId || ''}:${searchQuery || ''}:${page}:${limit}`;
  const now = Date.now();

  if (!refresh && inMemoryShortCache && inMemoryShortCache.key === cacheKey && now - inMemoryShortCache.timestamp < 3000) {
    return inMemoryShortCache.result;
  }

  // 1. Primary Read: Query SQLite Local Persistent Store
  let storeRes = await store.getNews({
    category,
    sourceId,
    searchQuery,
    limit,
    page,
  });

  // 2. Empty Store Recovery (Initial boot / fresh serverless cold-start)
  if (storeRes.total === 0) {
    try {
      const seeds = getSeedItems();
      if (seeds.length > 0) {
        await store.upsertNews(seeds);
        storeRes = await store.getNews({
          category,
          sourceId,
          searchQuery,
          limit,
          page,
        });
      }
    } catch (err) {
      console.warn('[news-fetcher] Aviso ao aplicar seed de recuperação:', err);
    }
  }

  // 3. Trigger background sync if interval has elapsed (keeps store fresh in real-time)
  triggerBackgroundSyncIfNeeded();

  const result: FetchNewsResult = {
    items: storeRes.items,
    total: storeRes.total,
    isRealTime: true,
    fromStore: true,
  };

  inMemoryShortCache = {
    key: cacheKey,
    result,
    timestamp: now,
  };

  return result;
}

export async function getNewsItemBySlugOrId(
  slugOrId: string,
  options?: { resolveApiLinks?: boolean }
): Promise<NewsItem | null> {
  if (!slugOrId) return null;

  const decoded = decodeURIComponent(slugOrId).toLowerCase().trim();
  const store = getNewsStore();
  await store.init();
  const shouldResolveApiLinks = Boolean(options?.resolveApiLinks);

  // 1. Query Local Persistent Store
  let item = await store.getNewsBySlugOrId(decoded, {
    deferMissingLinkFallback: shouldResolveApiLinks,
  });

  // 2. Fallback: Search bundled seed items
  if (!item) {
    const seeds = getSeedItems();
    const seedMatch = seeds.find(
      s => s.slug.toLowerCase() === decoded || s.id.toLowerCase() === decoded
    );
    if (seedMatch) {
      store.upsertNews([seedMatch]).catch(() => {});
      item = seedMatch;
    }
  }

  // 3. Fallback: Search upstream API on-demand and import to SQLite if found
  if (!item) {
    item = await findAndImportNewsItemFromApi(decoded);
  }

  // 4. Final check after triggering background sync if still missing
  if (!item) {
    triggerBackgroundSyncIfNeeded();
    item = await store.getNewsBySlugOrId(decoded, {
      deferMissingLinkFallback: shouldResolveApiLinks,
    });
  }

  if (!item) {
    return null;
  }

  // If requested (article page / API endpoint), resolve any embedded source-news links via API + DB
  if (shouldResolveApiLinks && item.contentHtml) {
    const unresolved = extractUnresolvedSourceNewsCandidates(item.contentHtml, {
      currentArticleSlug: item.slug,
      resolveSlugInDb: (c) => store.resolveSourceArticleSlug(c),
    });

    const apiResolved =
      unresolved.length > 0
        ? await resolveSourceNewsSlugsWithApi(unresolved, item.category)
        : new Map<string, string>();

    const rawAppUrl = (process.env.APP_URL || '').trim();
    const appUrl =
      rawAppUrl && !rawAppUrl.includes('MY_APP_URL')
        ? rawAppUrl.replace(/\/+$/, '')
        : '';

    const finalHtml = repairAndSanitizeArticleHtml(
      item.contentHtml,
      item.imageUrl ? [item.imageUrl] : [],
      {
        appUrl,
        appDomain: SITE_CONFIG.domain,
        currentArticleSlug: item.slug,
        resolveSlugInDb: (candidate) =>
          store.resolveSourceArticleSlug(candidate) ?? apiResolved.get(candidate) ?? null,
        deferMissingLinkFallback: false,
      }
    );

    return {
      ...item,
      contentHtml: finalHtml,
    };
  }

  return item;
}
