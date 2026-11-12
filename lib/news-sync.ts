// lib/news-sync.ts
import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getNewsStore, INewsStore, UpsertResult, PruneResult } from './news-store';
import { getNewsApiConfig, getNewsApiHeaders } from './api-config';
import { ALL_NEWS_SOURCES } from './sources';
import { NewsItem, NewsApiSourceItem } from './types';
import { slugify, categorySlugify } from './slug';
import { cleanTitle, cleanFullNewsText, isForbiddenVideoPost, removeTruncationMarkers, fixEncoding, repairAndSanitizeArticleHtml, extractAllImagesFromHtml, stripHtmlTags } from './sanitizer';
import { ensureCompleteArticleText } from './article-extractor';

interface UpstreamArticleItem {
  id?: string | number;
  slug?: string;
  title?: string;
  description?: string;
  content?: string;
  pubDate?: string;
  date?: string;
  category?: string;
  imageUrl?: string;
  mediaUrl?: string;
  author?: string;
  link?: string;
  alt?: string;
}

interface UpstreamSourceResponse {
  items?: UpstreamArticleItem[];
  meta?: {
    totalItems?: number;
    currentPage?: number;
    totalPages?: number;
  };
}

export interface SyncOptions {
  force?: boolean;
  limitPerSource?: number;
  sourcesSubset?: string[];
}

export interface SyncExecutionResult {
  status: 'success' | 'partial' | 'error' | 'already_running';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalSources: number;
  sourcesSuccess: number;
  sourcesFailed: number;
  itemsFetched: number;
  itemsInserted: number;
  itemsUpdated: number;
  itemsUnchanged: number;
  totalInStore: number;
  pruned: PruneResult;
  revalidated: boolean;
  message: string;
}

// In-memory concurrency lock
let isSyncRunning = false;
let currentSyncPromise: Promise<SyncExecutionResult> | null = null;
let lastSyncTimestamp = 0;

function isValidImageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('placeholder') ||
    lower.includes('data:image') ||
    lower.includes('pixel') ||
    lower.includes('1x1') ||
    lower.includes('blank.gif')
  ) {
    return false;
  }
  return true;
}

function extractImagesFromContent(content?: string): string[] {
  if (!content) return [];
  const images: string[] = [];
  const imgRegex = /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    if (isValidImageUrl(match[1])) {
      images.push(match[1]);
    }
  }
  return images;
}

// Concurrency pool helper
async function asyncPool<T, R>(
  poolLimit: number,
  array: T[],
  iteratorFn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<void>[] = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (poolLimit <= array.length) {
      const e: Promise<void> = p.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.allSettled(ret);
}

// Resilient fetch with fallback URL, retry with exponential backoff, and timeout
async function fetchWithRetryAndFallback<T>(endpoint: string, timeoutMs = 6000): Promise<T | null> {
  const { baseUrl, fallbackUrl } = getNewsApiConfig();
  const headers = getNewsApiHeaders();

  const tryFetch = async (targetBase: string, retryCount = 1): Promise<T | null> => {
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const url = `${targetBase}${endpoint}`;
        const res = await fetch(url, {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeout);
        if (res.ok) {
          return (await res.json()) as T;
        }
      } catch {
        clearTimeout(timeout);
      }

      if (attempt < retryCount) {
        // Backoff delay
        await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
      }
    }
    return null;
  };

  // 1. Try Primary baseUrl
  const primaryResult = await tryFetch(baseUrl, 1);
  if (primaryResult) return primaryResult;

  // 2. Try Fallback url if different
  if (fallbackUrl && fallbackUrl !== baseUrl) {
    const fallbackResult = await tryFetch(fallbackUrl, 1);
    if (fallbackResult) return fallbackResult;
  }

  return null;
}

export async function syncNewsSources(options: SyncOptions = {}): Promise<SyncExecutionResult> {
  // Concurrency lock check
  if (isSyncRunning && currentSyncPromise) {
    return currentSyncPromise;
  }

  isSyncRunning = true;
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  currentSyncPromise = (async (): Promise<SyncExecutionResult> => {
    const store = getNewsStore();
    await store.init();

    const limitPerSource = options.limitPerSource || 50;
    let targetSources = ALL_NEWS_SOURCES;

    if (options.sourcesSubset && options.sourcesSubset.length > 0) {
      const set = new Set(options.sourcesSubset);
      targetSources = ALL_NEWS_SOURCES.filter(s => set.has(s.id));
    }

    let sourcesSuccess = 0;
    let sourcesFailed = 0;
    let itemsFetched = 0;
    const allParsedItems: NewsItem[] = [];
    const sharedCategoryImages = new Map<string, string[]>();
    const allValidImages: string[] = [];

    // Parallel processing with bounded concurrency of 6 to prevent server socket starvation
    const results = await asyncPool(6, targetSources, async (source: NewsApiSourceItem) => {
      try {
        const rawData = await fetchWithRetryAndFallback<UpstreamSourceResponse | UpstreamArticleItem[]>(
          `/api/news/${source.id}?limit=${limitPerSource}`,
          5000
        );

        let items: UpstreamArticleItem[] = [];

        if (rawData) {
          if (Array.isArray(rawData)) {
            items = rawData;
          } else if (rawData.items && Array.isArray(rawData.items)) {
            items = rawData.items;
          }
        }

        if (items.length === 0) {
          return { source, items: [], imageMap: new Map<string, string[]>(), success: false };
        }

        // Only fetch image registry if articles lack image URLs (saves up to 77 redundant network requests)
        const needsImages = items.some(it => !it.imageUrl && !it.mediaUrl);
        let imgRegistry: unknown = null;
        if (needsImages) {
          imgRegistry = await fetchWithRetryAndFallback<unknown>(`/api/images/${source.id}`, 3500);
        }

        // Image Map
        const imageMap = new Map<string, string[]>();

        if (imgRegistry) {
          let list: unknown[] = [];
          if (Array.isArray(imgRegistry)) {
            list = imgRegistry;
          } else if (typeof imgRegistry === 'object' && imgRegistry !== null) {
            const obj = imgRegistry as Record<string, unknown>;
            if (Array.isArray(obj.items)) {
              list = obj.items;
            } else {
              for (const [k, v] of Object.entries(obj)) {
                if (typeof v === 'string' && isValidImageUrl(v)) {
                  imageMap.set(k, [v]);
                }
              }
            }
          }

          for (const item of list) {
            if (!item || typeof item !== 'object') continue;
            const entry = item as Record<string, unknown>;
            const u = String(entry.imageUrl || entry.url || entry.src || '').trim();
            if (isValidImageUrl(u)) {
              const keys = [
                String(entry.id || ''),
                String(entry.slug || ''),
                String(entry.title || ''),
              ].filter(Boolean);
              for (const k of keys) {
                const cur = imageMap.get(k) || [];
                if (!cur.includes(u)) cur.push(u);
                imageMap.set(k, cur);
              }
            }
          }
        }

        return { source, items, imageMap, success: true };
      } catch {
        return { source, items: [], imageMap: new Map<string, string[]>(), success: false };
      }
    });

    for (const res of results) {
      if (res.status !== 'fulfilled' || !res.value.success) {
        sourcesFailed++;
        continue;
      }

      sourcesSuccess++;
      const { source, items, imageMap } = res.value;

      for (const item of items) {
        if (!item || !item.title) continue;
        const rawTitle = cleanTitle(item.title);
        if (rawTitle.length < 5) continue;

        const rawContent = item.content || item.description || '';
        if (isForbiddenVideoPost(rawTitle, rawContent)) continue;

        itemsFetched++;

        // Category mapping - prioritize live category from API item
        let effectiveCategory = (item.category && item.category.trim()) || source.category || 'Brasil';
        if (effectiveCategory === 'Notícias Gerais' || effectiveCategory === 'noticias-gerais') {
          effectiveCategory = 'Brasil';
        }
        if (!item.category) {
          if (source.id === '8281449136684') effectiveCategory = 'Política';
          else if (source.id === '6389841444633' || source.id === '3815913481419') effectiveCategory = 'Esporte';
          else if (source.id === '3422817479195') effectiveCategory = 'Economia';
          else if (source.id === '8833539123215') effectiveCategory = 'Cultura';
          else if (source.id === '8346116142997') effectiveCategory = 'Saúde';
        }

        effectiveCategory = fixEncoding(effectiveCategory);
        const categoryId = categorySlugify(effectiveCategory);

        // Extract potential image from raw description if it contains <img
        const descImgMatch = (item.description || '').match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i) ||
                             (item.description || '').match(/&lt;img\b[^&]*src=[&"']([^&"']+)[&"'][^&]*&gt;/i);
        let extractedFromDesc = '';
        if (descImgMatch && descImgMatch[1]) {
          extractedFromDesc = descImgMatch[1].replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo').trim();
        }

        // Summary - strictly stripped of all HTML tags and attributes
        const rawDesc = item.description || rawContent || '';
        let summary = stripHtmlTags(rawDesc);
        summary = fixEncoding(removeTruncationMarkers(cleanFullNewsText(summary)));
        summary = summary.replace(/<[^>]+>/g, '').replace(/&lt;[^&]+&gt;/g, '').replace(/\s+/g, ' ').trim();
        if (summary.length > 260) {
          summary = summary.substring(0, 260).replace(/\s+[^\s]*$/, '') + '…';
        }

        // Full content HTML with repaired figures and closed attributes
        const rawContentHtml = ensureCompleteArticleText(
          item.content ? item.content.split(/\n\n+/).map(p => `<p>${cleanFullNewsText(p)}</p>`).join('') : summary,
          rawTitle,
          effectiveCategory
        );
        const contentHtml = repairAndSanitizeArticleHtml(rawContentHtml);

        // Collect article images strictly belonging to this specific article
        const images: string[] = [];
        const addImg = (u?: string) => {
          if (isValidImageUrl(u) && !images.includes(u!)) {
            images.push(u!.replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo'));
          }
        };

        if (item.imageUrl) addImg(item.imageUrl);
        if (item.mediaUrl) addImg(item.mediaUrl);
        if (extractedFromDesc) addImg(extractedFromDesc);

        // Strict lookup by exact article unique identifiers (id, slug, exact title)
        const lookupKeys = [String(item.id || ''), String(item.slug || ''), item.title].filter(Boolean);
        for (const k of lookupKeys) {
          const found = imageMap.get(k as string);
          if (found) found.forEach(addImg);
        }

        // Only genuine <img> in the article's own content
        extractAllImagesFromHtml(item.content || '').forEach(addImg);

        // Author sanitization
        let author = (item.author || '').trim();
        if (!author || /^\d+$/.test(author) || /admin|redacao|portal/i.test(author)) {
          author = 'Norma Jurídica';
        }
        author = fixEncoding(author);

        const itemIdStr = String(item.id || item.slug || rawTitle);
        const slug = slugify(rawTitle, itemIdStr);
        const pubDate = item.pubDate || item.date || new Date().toISOString();

        // Strict image association: genuine image from upstream API / article
        let finalImageUrl = images[0] || '';

        const newsItem: NewsItem & { sourceId: string } = {
          id: slug,
          slug,
          title: fixEncoding(rawTitle),
          link: item.link && item.link.startsWith('/noticia/') ? item.link : `/noticia/${slug}`,
          pubDate,
          isoDate: pubDate,
          timeAgo: '',
          category: effectiveCategory,
          categoryId,
          source: 'Norma Jurídica',
          sourceId: source.id,
          summary,
          contentHtml,
          imageUrl: finalImageUrl,
          images,
          imageCaption: fixEncoding(item.alt || `Registro jornalístico editorial • ${effectiveCategory}`),
          author,
          originalCategory: source.category,
        };

        allParsedItems.push(newsItem as unknown as NewsItem);
      }
    }

    // Deduplicate parsed batch by slug/title (preserving exact original images from API)
    const seen = new Set<string>();
    const uniqueBatch: NewsItem[] = [];
    for (const item of allParsedItems) {
      const key = item.slug || item.id;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueBatch.push(item);
      }
    }

    // Upsert batch to SQLite
    const upsertRes: UpsertResult = await store.upsertNews(uniqueBatch);

    // Prune store (FIFO by pubDate, keeping newest per source, and retention limit)
    const pruneRes: PruneResult = await store.prune();

    const durationMs = Date.now() - startTime;
    const completedAt = new Date().toISOString();
    const revalidated = upsertRes.inserted > 0 || upsertRes.updated > 0;

    if (revalidated) {
      try {
        revalidateTag('news');
        revalidateTag('posts');
        revalidatePath('/', 'layout');
      } catch {}
    }

    const syncStatus: 'success' | 'partial' | 'error' =
      sourcesFailed === 0 ? 'success' : sourcesSuccess > 0 ? 'partial' : 'error';

    const syncMeta = {
      lastSyncAt: completedAt,
      lastSyncDurationMs: durationMs,
      lastSyncStatus: syncStatus,
      sourcesSynced: sourcesSuccess,
      totalSources: targetSources.length,
      itemsSynced: uniqueBatch.length,
      itemsInserted: upsertRes.inserted,
      itemsUpdated: upsertRes.updated,
    };

    await store.setSyncMetadata(syncMeta);
    lastSyncTimestamp = Date.now();

    return {
      status: syncStatus,
      startedAt,
      completedAt,
      durationMs,
      totalSources: targetSources.length,
      sourcesSuccess,
      sourcesFailed,
      itemsFetched,
      itemsInserted: upsertRes.inserted,
      itemsUpdated: upsertRes.updated,
      itemsUnchanged: upsertRes.unchanged,
      totalInStore: upsertRes.totalInStore,
      pruned: pruneRes,
      revalidated,
      message: `Sincronização concluída: ${upsertRes.inserted} novos, ${upsertRes.updated} atualizados, ${pruneRes.totalPruned} podados no rodízio. Total no banco: ${upsertRes.totalInStore}`,
    };
  })()
    .finally(() => {
      isSyncRunning = false;
      currentSyncPromise = null;
    });

  return currentSyncPromise;
}

// Background scheduler trigger helper
export function triggerBackgroundSyncIfNeeded(): void {
  const syncIntervalSec = parseInt(process.env.NEWS_SYNC_INTERVAL_SECONDS || '60', 10);
  const intervalMs = Math.max(60, syncIntervalSec) * 1000;

  if (Date.now() - lastSyncTimestamp < intervalMs) {
    return;
  }

  if (isSyncRunning) {
    return;
  }

  // Non-blocking background sync execution
  setTimeout(() => {
    syncNewsSources().catch(err => {
      console.warn('Erro na sincronização em segundo plano:', err?.message || err);
    });
  }, 10);
}
