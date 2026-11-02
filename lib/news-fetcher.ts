// lib/news-fetcher.ts
import 'server-only';

import { NewsItem } from './types';
import { getNewsStore, formatTimeAgo } from './news-store';
import { syncNewsSources, triggerBackgroundSyncIfNeeded } from './news-sync';

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

  // 1. Primary Read: Query SQLite Local Persistent Store
  let storeRes = await store.getNews({
    category,
    sourceId,
    searchQuery,
    limit,
    page,
  });

  // 2. Empty Store Recovery (Initial boot / fresh install)
  if (storeRes.total === 0 && (!category || category === 'all' || category === 'todas') && !searchQuery) {
    try {
      // Cold-start initial sync
      await syncNewsSources({ limitPerSource: 20 });
      storeRes = await store.getNews({
        category,
        sourceId,
        searchQuery,
        limit,
        page,
      });
    } catch (err) {
      console.error('Falha no bootstrap inicial de sincronização:', err);
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

export async function getNewsItemBySlugOrId(slugOrId: string): Promise<NewsItem | null> {
  if (!slugOrId) return null;

  const store = getNewsStore();
  await store.init();

  // 1. Query Local Persistent Store
  const item = await store.getNewsBySlugOrId(slugOrId);
  if (item) {
    return item;
  }

  // 2. Fallback: If not found in store, check if background sync is needed
  triggerBackgroundSyncIfNeeded();

  // Re-check once if background sync was needed or item was recently inserted
  return await store.getNewsBySlugOrId(slugOrId);
}
