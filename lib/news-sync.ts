// lib/news-sync.ts
import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getNewsStore, cleanCategoryName, UpsertResult, PruneResult } from './news-store';
import { getNewsApiConfig, getNewsApiHeaders } from './api-config';
import { ALL_NEWS_SOURCES, ALL_CATEGORIES, mergeDynamicCategories } from './sources';
import { NewsItem, NewsApiSourceItem } from './types';
import { slugify, categorySlugify } from './slug';
import { cleanTitle, cleanFullNewsText, isForbiddenVideoPost, removeTruncationMarkers, fixEncoding, repairAndSanitizeArticleHtml, extractAllImagesFromHtml, stripHtmlTags, normalizeImageKey, extractSourceNewsSlug, matchSlugCandidate } from './sanitizer';
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

// Resilient fetch with retry and exponential backoff exclusively against NEWS_API_BASE_URL
async function fetchWithRetryAndFallback<T>(endpoint: string, timeoutMs = 6000): Promise<T | null> {
  const { baseUrl } = getNewsApiConfig();
  const headers = getNewsApiHeaders();

  const retryCount = 1;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `${baseUrl}${endpoint}`;
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
      await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }

  return null;
}

function buildNewsItemFromUpstream(
  item: UpstreamArticleItem,
  source: NewsApiSourceItem,
  imageMap: Map<string, string[]>
): (NewsItem & { sourceId: string }) | null {
  if (!item || !item.title) return null;
  const rawTitle = cleanTitle(item.title);
  if (rawTitle.length < 5) return null;

  const rawContent = item.content || item.description || '';
  if (isForbiddenVideoPost(rawTitle, rawContent)) return null;

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

  effectiveCategory = cleanCategoryName(fixEncoding(effectiveCategory));
  const categoryId = categorySlugify(effectiveCategory);

  // Extract potential image from raw description if it contains <img
  const descImgMatch =
    (item.description || '').match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i) ||
    (item.description || '').match(/&lt;img\b[^&]*src=[&"']([^&"']+)[&"'][^&]*&gt;/i);
  let extractedFromDesc = '';
  if (descImgMatch && descImgMatch[1]) {
    extractedFromDesc = descImgMatch[1].replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo').trim();
  }

  // Summary - strictly stripped of all HTML tags and attributes (including truncated tags)
  const rawDesc = item.description || rawContent || '';
  let summary = stripHtmlTags(rawDesc);
  summary = fixEncoding(removeTruncationMarkers(cleanFullNewsText(summary)));
  summary = stripHtmlTags(summary);
  if (summary.length > 260) {
    summary = summary.substring(0, 260).replace(/\s+[^\s]*$/, '') + '…';
  }

  // Collect article images strictly belonging to this specific article (deduplicated by canonical key)
  const images: string[] = [];
  const seenImgKeys = new Set<string>();
  const addImg = (u?: string) => {
    if (!u) return;
    const fixed = u.replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo').trim();
    if (!isValidImageUrl(fixed)) return;
    const key = normalizeImageKey(fixed);
    if (key && !seenImgKeys.has(key)) {
      seenImgKeys.add(key);
      images.push(fixed);
    }
  };

  if (item.imageUrl) addImg(item.imageUrl);
  if (item.mediaUrl) addImg(item.mediaUrl);
  if (extractedFromDesc) addImg(extractedFromDesc);

  const lookupKeys = [String(item.id || ''), String(item.slug || ''), item.title].filter(Boolean);
  for (const k of lookupKeys) {
    const found = imageMap.get(k as string);
    if (found) found.forEach(addImg);
  }

  extractAllImagesFromHtml(item.content || '').forEach(addImg);

  const finalImageUrl = images[0] || '';

  const rawContentHtml = ensureCompleteArticleText(
    item.content ? item.content.split(/\n\n+/).map(p => `<p>${cleanFullNewsText(p)}</p>`).join('') : summary,
    rawTitle,
    effectiveCategory
  );
  const contentHtml = repairAndSanitizeArticleHtml(
    rawContentHtml,
    finalImageUrl ? [finalImageUrl] : []
  );

  let author = (item.author || '').trim();
  if (!author || /^\d+$/.test(author) || /admin|redacao|portal/i.test(author)) {
    author = 'Norma Jurídica';
  }
  author = fixEncoding(author);

  const itemIdStr = String(item.id || item.slug || rawTitle);
  const slug = slugify(rawTitle, itemIdStr);
  const pubDate = item.pubDate || item.date || new Date().toISOString();

  return {
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
}

// Bounded in-memory caches for on-demand API article search
const apiArticleLookupCache = new Map<string, { item: NewsItem | null; expiresAt: number }>();
const inFlightApiLookups = new Map<string, Promise<NewsItem | null>>();
let recentGlobalFeedCache: { items: UpstreamArticleItem[]; expiresAt: number } | null = null;

function extractItemsArrayFromPayload(rawData: unknown): UpstreamArticleItem[] {
  if (!rawData) return [];
  if (Array.isArray(rawData)) return rawData as UpstreamArticleItem[];
  if (typeof rawData === 'object') {
    const obj = rawData as UpstreamSourceResponse;
    if (Array.isArray(obj.items)) return obj.items;
  }
  return [];
}

function inferCategoryFromHrefOrHint(originalHref?: string, categoryHint?: string): string {
  if (originalHref) {
    const lower = originalHref.toLowerCase();
    const pathHints: Array<[RegExp, string]> = [
      [/\/(?:esportes?|futebol)\//, 'Esporte'],
      [/\/(?:politica|eleicoes|poder)\//, 'Política'],
      [/\/(?:economia|negocios|mercado)\//, 'Economia'],
      [/\/(?:financas)\//, 'Finanças'],
      [/\/(?:justica|direito|stf|stj)\//, 'Justiça'],
      [/\/(?:educacao|vestibular|enem)\//, 'Educação'],
      [/\/(?:saude|bem-estar)\//, 'Saúde'],
      [/\/(?:mundo|internacional)\//, 'Mundo'],
      [/\/(?:cultura|entretenimento|pop)\//, 'Cultura'],
      [/\/(?:tecnologia|games|tech)\//, 'Tecnologia e Games'],
      [/\/(?:tocantins)\//, 'Tocantins'],
      [/\/(?:goias)\//, 'Goiás'],
      [/\/(?:para)\//, 'Pará'],
      [/\/(?:parana)\//, 'Paraná'],
      [/\/(?:maranhao)\//, 'Maranhão'],
      [/\/(?:bahia)\//, 'Bahia'],
      [/\/(?:sao-paulo)\//, 'São Paulo'],
      [/\/(?:rio-de-janeiro)\//, 'Rio de Janeiro'],
    ];
    for (const [rx, cat] of pathHints) {
      if (rx.test(lower)) return cat;
    }
  }
  return categoryHint || '';
}

function findMatchingUpstreamItem(
  items: UpstreamArticleItem[],
  candidateSlug: string
): UpstreamArticleItem | null {
  for (const it of items) {
    if (!it || !it.title) continue;
    const rawTitle = cleanTitle(it.title);
    if (rawTitle.length < 5) continue;
    const titleSlug = slugify(rawTitle, String(it.id || it.slug || rawTitle));
    const itemSlug = it.slug ? String(it.slug).toLowerCase().trim() : '';
    const linkSlug = it.link ? extractSourceNewsSlug(it.link) : null;
    if (matchSlugCandidate(candidateSlug, itemSlug || titleSlug, titleSlug, linkSlug)) {
      return it;
    }
  }
  return null;
}

export async function findAndImportNewsItemFromApi(
  candidateSlugOrId: string,
  options: { categoryHint?: string; originalHref?: string } = {}
): Promise<NewsItem | null> {
  const cleanCandidate = (candidateSlugOrId || '').toLowerCase().trim().replace(/^-+|-+$/g, '');
  if (cleanCandidate.length < 6) return null;

  const now = Date.now();
  const cached = apiArticleLookupCache.get(cleanCandidate);
  if (cached && cached.expiresAt > now) {
    return cached.item;
  }

  const inFlight = inFlightApiLookups.get(cleanCandidate);
  if (inFlight) {
    return inFlight;
  }

  const lookupPromise = (async (): Promise<NewsItem | null> => {
    try {
      const store = getNewsStore();
      await store.init();

      // Double-check DB before querying upstream API
      const dbExistingSlug = store.resolveSourceArticleSlug(cleanCandidate);
      if (dbExistingSlug) {
        const dbItem = await store.getNewsBySlugOrId(dbExistingSlug);
        if (dbItem) {
          apiArticleLookupCache.set(cleanCandidate, { item: dbItem, expiresAt: Date.now() + 30 * 60_000 });
          return dbItem;
        }
      }

      const inferredCat = inferCategoryFromHrefOrHint(options.originalHref, options.categoryHint);
      const defaultSource: NewsApiSourceItem = {
        id: 'api-lookup',
        endpoint: '/api/news',
        category: inferredCat || 'Brasil',
        site: '',
        type: 'wp-api',
        name: inferredCat || 'Brasil',
        active: true,
      };

      const saveAndReturn = async (rawItem: UpstreamArticleItem, src: NewsApiSourceItem): Promise<NewsItem | null> => {
        const built = buildNewsItemFromUpstream(rawItem, src, new Map());
        if (!built) return null;
        await store.upsertNews([built as unknown as NewsItem]);
        const fresh = await store.getNewsBySlugOrId(built.slug);
        const resultItem = fresh || (built as unknown as NewsItem);
        if (apiArticleLookupCache.size > 1000) {
          apiArticleLookupCache.clear();
        }
        apiArticleLookupCache.set(cleanCandidate, { item: resultItem, expiresAt: Date.now() + 30 * 60_000 });
        return resultItem;
      };

      // 1. Check cached recent global feed (/api/news?limit=100)
      if (!recentGlobalFeedCache || recentGlobalFeedCache.expiresAt <= Date.now()) {
        const globalData = await fetchWithRetryAndFallback<UpstreamSourceResponse | UpstreamArticleItem[]>(
          '/api/news?limit=100',
          3000
        );
        const globalItems = extractItemsArrayFromPayload(globalData);
        recentGlobalFeedCache = {
          items: globalItems,
          expiresAt: Date.now() + (globalItems.length > 0 ? 90_000 : 20_000),
        };
      }

      if (recentGlobalFeedCache.items.length > 0) {
        const matchedGlobal = findMatchingUpstreamItem(recentGlobalFeedCache.items, cleanCandidate);
        if (matchedGlobal) {
          return await saveAndReturn(matchedGlobal, defaultSource);
        }
      }

      // 2. Targeted API queries (direct slug, keyword search, and category endpoint in parallel)
      const searchWords = cleanCandidate
        .split('-')
        .filter((w) => w.length >= 4)
        .slice(0, 4)
        .join(' ');

      const queryEndpoints: string[] = [
        `/api/news?slug=${encodeURIComponent(cleanCandidate)}&limit=10`,
      ];
      if (searchWords) {
        queryEndpoints.push(`/api/news?search=${encodeURIComponent(searchWords)}&limit=15`);
      }
      if (inferredCat) {
        queryEndpoints.push(`/api/news/category/${encodeURIComponent(inferredCat)}?limit=50`);
      }

      const targetedResults = await Promise.allSettled(
        queryEndpoints.map((ep) =>
          fetchWithRetryAndFallback<UpstreamSourceResponse | UpstreamArticleItem[]>(ep, 3000)
        )
      );

      for (const r of targetedResults) {
        if (r.status !== 'fulfilled' || !r.value) continue;
        const list = extractItemsArrayFromPayload(r.value);
        const matched = findMatchingUpstreamItem(list, cleanCandidate);
        if (matched) {
          return await saveAndReturn(matched, defaultSource);
        }
      }

      // 3. Targeted per-source check (up to 3 matching category sources, fast timeout)
      if (inferredCat) {
        const normCat = inferredCat.toLowerCase();
        const catSources = ALL_NEWS_SOURCES.filter(
          (s) => s.active && (s.category || '').toLowerCase() === normCat
        ).slice(0, 3);

        if (catSources.length > 0) {
          const sourceResults = await Promise.allSettled(
            catSources.map(async (src) => {
              const raw = await fetchWithRetryAndFallback<UpstreamSourceResponse | UpstreamArticleItem[]>(
                `/api/news/${src.id}?limit=50`,
                3000
              );
              return { src, list: extractItemsArrayFromPayload(raw) };
            })
          );

          for (const r of sourceResults) {
            if (r.status !== 'fulfilled') continue;
            const matched = findMatchingUpstreamItem(r.value.list, cleanCandidate);
            if (matched) {
              return await saveAndReturn(matched, r.value.src);
            }
          }
        }
      }

      // Not found in DB or upstream API -> cache miss cleanly
      if (apiArticleLookupCache.size > 1000) {
        apiArticleLookupCache.clear();
      }
      apiArticleLookupCache.set(cleanCandidate, { item: null, expiresAt: Date.now() + 5 * 60_000 });
      return null;
    } catch {
      return null;
    } finally {
      inFlightApiLookups.delete(cleanCandidate);
    }
  })();

  inFlightApiLookups.set(cleanCandidate, lookupPromise);
  return lookupPromise;
}

export async function resolveSourceNewsSlugsWithApi(
  candidates: Array<{ candidateSlug: string; originalHref?: string }>,
  categoryHint?: string
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  if (!candidates || candidates.length === 0) return resolved;

  const unique = candidates.slice(0, 6);
  const results = await asyncPool(3, unique, async (cand) => {
    const item = await findAndImportNewsItemFromApi(cand.candidateSlug, {
      categoryHint,
      originalHref: cand.originalHref,
    });
    return { candidateSlug: cand.candidateSlug, matchedSlug: item?.slug || null };
  });

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.matchedSlug) {
      resolved.set(r.value.candidateSlug, r.value.matchedSlug);
    }
  }
  return resolved;
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

        const newsItem = buildNewsItemFromUpstream(item, source, imageMap);
        if (newsItem) {
          allParsedItems.push(newsItem as unknown as NewsItem);
        }
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

    // Continuously sync and merge categories from upstream API endpoints + sources + DB
    try {
      const discoveredCats: string[] = [
        ...ALL_NEWS_SOURCES.map(s => s.category),
        ...uniqueBatch.map(it => it.category),
      ];

      const [apiCats, apiTypes] = await Promise.all([
        fetchWithRetryAndFallback<unknown>('/api/categories', 3000),
        fetchWithRetryAndFallback<unknown>('/api/types', 3000),
      ]);

      const extractNames = (payload: unknown) => {
        if (!payload) return;
        if (Array.isArray(payload)) {
          for (const entry of payload) {
            if (typeof entry === 'string') discoveredCats.push(entry);
            else if (entry && typeof entry === 'object') {
              const obj = entry as Record<string, unknown>;
              if (typeof obj.name === 'string') discoveredCats.push(obj.name);
              else if (typeof obj.category === 'string') discoveredCats.push(obj.category);
            }
          }
        } else if (typeof payload === 'object') {
          const obj = payload as Record<string, unknown>;
          if (Array.isArray(obj.categories)) extractNames(obj.categories);
          if (Array.isArray(obj.types)) extractNames(obj.types);
          if (Array.isArray(obj.items)) extractNames(obj.items);
        }
      };

      extractNames(apiCats);
      extractNames(apiTypes);

      const distinctDbCats = await store.getDistinctCategories();
      discoveredCats.push(...distinctDbCats);

      const existingDynamic = await store.getDynamicCategories();
      const mergedCategories = mergeDynamicCategories(discoveredCats, existingDynamic.length ? existingDynamic : ALL_CATEGORIES);
      await store.setDynamicCategories(mergedCategories);
    } catch {}

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
