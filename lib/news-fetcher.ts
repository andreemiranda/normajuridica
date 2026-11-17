// lib/news-fetcher.ts
import 'server-only';

import { NewsItem } from './types';
import { getNewsStore, formatTimeAgo } from './news-store';
import {
  syncNewsSources,
  triggerBackgroundSyncIfNeeded,
  findAndImportNewsItemFromApi,
  resolveSourceNewsSlugsWithApi,
} from './news-sync';
import { extractUnresolvedSourceNewsCandidates, repairAndSanitizeArticleHtml, stripHtmlTags } from './sanitizer';
import { formatArticleParagraphsHtml, fetchFullArticleBody } from './article-extractor';
import { SITE_CONFIG, getBaseUrl } from './site-config';

export { formatTimeAgo };

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

  // 1. Primary Read: Query SQLite Local Persistent Store (populated exclusively by upstream API)
  let storeRes = await store.getNews({
    category,
    sourceId,
    searchQuery,
    limit,
    page,
  });

  // 2. Empty Store Recovery: sync live upstream API sources directly (never synthetic seeds)
  if (storeRes.total === 0 && !refresh) {
    try {
      await syncNewsSources({ force: true });
      storeRes = await store.getNews({
        category,
        sourceId,
        searchQuery,
        limit,
        page,
      });
    } catch (err) {
      console.warn('[news-fetcher] Aviso ao sincronizar API na recuperação inicial:', err);
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

  // 2. Search upstream API on-demand and import to SQLite if found
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

  // If stored content is truncated/short (< 450 plain chars or <= 1 paragraph) and sourceUrl is known, extract full article body
  if (shouldResolveApiLinks) {
    const plainLen = stripHtmlTags(item.contentHtml || '').length;
    const pCount = ((item.contentHtml || '').match(/<p\b/gi) || []).length;
    if ((plainLen < 450 || pCount <= 1) && item.sourceUrl) {
      try {
        const fetchedFull = await fetchFullArticleBody(item.sourceUrl, 50000);
        if (stripHtmlTags(fetchedFull).length > plainLen + 100) {
          item = { ...item, contentHtml: formatArticleParagraphsHtml(fetchedFull) };
          store.upsertNews([item]).catch(() => {});
        }
      } catch {}
    }
  }

  // If requested (article page / API endpoint), resolve any embedded source-news links via API + DB
  if (shouldResolveApiLinks && item.contentHtml) {
    const formatted = formatArticleParagraphsHtml(item.contentHtml);
    const unresolved = extractUnresolvedSourceNewsCandidates(formatted, {
      currentArticleSlug: item.slug,
      resolveSlugInDb: (c) => store.resolveSourceArticleSlug(c),
    });

    const apiResolved =
      unresolved.length > 0
        ? await resolveSourceNewsSlugsWithApi(unresolved, item.category)
        : new Map<string, string>();

    const appUrl = getBaseUrl();

    const finalHtml = repairAndSanitizeArticleHtml(
      formatted,
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
