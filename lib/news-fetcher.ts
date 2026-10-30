// lib/news-fetcher.ts
import 'server-only';

import { NewsItem, NewsApiSourceItem } from './types';
import { getNewsApiConfig, getNewsApiHeaders } from './api-config';
import {
  getSourcesByCategory,
  resolveCategoryDisplayName,
  normalizeCategoryText,
  ALL_NEWS_SOURCES,
  DEFAULT_ALL_SOURCE_IDS
} from './sources';
import { slugify, categorySlugify } from './slug';
import { cleanTitle, cleanFullNewsText, isForbiddenVideoPost, removeTruncationMarkers, fixEncoding } from './sanitizer';
import { ensureCompleteArticleText } from './article-extractor';

interface CacheEntry {
  items: NewsItem[];
  timestamp: number;
}

// In-memory cache with 20s TTL (sincronização contínua com intervalo de 20 segundos)
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 20 * 1000;


// O(1) in-memory index
const newsIndex = new Map<string, NewsItem>();

export function clearNewsCache() {
  memoryCache.clear();
  newsIndex.clear();
}

export function formatTimeAgo(dateStr: string): string {
  try {
    const pub = new Date(dateStr).getTime();
    if (isNaN(pub)) return 'Recentemente';

    const diffMs = Date.now() - pub;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);

    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin === 1) return 'Há 1 minuto';
    if (diffMin < 60) return `Há ${diffMin} minutos`;
    if (diffHours === 1) return 'Há 1 hora';
    if (diffHours < 24) return `Há ${diffHours} horas`;
    if (diffHours < 48) return 'Ontem';

    const d = new Date(pub);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return 'Recentemente';
  }
}

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

// Concurrency pool helper for executing tasks with max concurrency
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

// Fetch helper with timeout and fallback
async function fetchWithFallback<T>(endpoint: string): Promise<T | null> {
  const { baseUrl, fallbackUrl } = getNewsApiConfig();
  const headers = getNewsApiHeaders();

  const tryFetch = async (targetBase: string): Promise<T | null> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const url = `${targetBase}${endpoint}`;
      const res = await fetch(url, {
        headers,
        signal: controller.signal,
        next: { revalidate: 20, tags: ['news', 'posts'] },
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      clearTimeout(timeout);
      return null;
    }
  };

  // Try primary
  let result = await tryFetch(baseUrl);
  if (result) return result;

  // Try fallback if primary fails and differs
  if (fallbackUrl && fallbackUrl !== baseUrl) {
    result = await tryFetch(fallbackUrl);
  }

  return result;
}

interface UpstreamArticleItem {
  id?: string | number;
  title?: string;
  slug?: string;
  alt?: string;
  description?: string;
  content?: string;
  pubDate?: string;
  author?: string;
  imageUrl?: string;
  mediaUrl?: string;
  link?: string;
  _links?: unknown;
}

interface UpstreamSourceResponse {
  items?: UpstreamArticleItem[];
  meta?: {
    totalItems?: number;
    totalPages?: number;
    currentPage?: number;
  };
}

export async function fetchNews(options?: {
  category?: string;
  sourceId?: string;
  searchQuery?: string;
  page?: number;
  limit?: number;
  refresh?: boolean;
}): Promise<{ items: NewsItem[]; total: number; isRealTime: boolean }> {
  const category = options?.category || 'all';
  const sourceId = options?.sourceId;
  const searchQuery = (options?.searchQuery || '').trim().toLowerCase();
  const page = options?.page || 1;
  const limit = options?.limit || 10;
  const refresh = options?.refresh || false;

  const cacheKey = `${category}_${sourceId || 'all'}_${searchQuery}_${page}_${limit}`;

  if (!refresh) {
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        items: cached.items,
        total: cached.items.length,
        isRealTime: true,
      };
    }
  }

  // Determine which sources to query
  let sourcesToQuery: NewsApiSourceItem[] = [];

  if (sourceId) {
    const found = ALL_NEWS_SOURCES.find(s => s.id === sourceId);
    if (found) sourcesToQuery = [found];
  } else if (category && category !== 'all' && category !== 'todas') {
    sourcesToQuery = getSourcesByCategory(category);
  } else {
    // Home / Todas: representative active source from each category to ensure 100% category coverage
    const grouped = new Map<string, NewsApiSourceItem[]>();
    for (const s of ALL_NEWS_SOURCES.filter(item => item.active !== false)) {
      const list = grouped.get(s.category) || [];
      list.push(s);
      grouped.set(s.category, list);
    }
    const representativeSources: NewsApiSourceItem[] = [];
    for (const list of grouped.values()) {
      const picked = refresh ? list[Math.floor(Math.random() * list.length)] : list[0];
      representativeSources.push(picked);
    }
    sourcesToQuery = representativeSources;
  }

  if (sourcesToQuery.length === 0) {
    sourcesToQuery = ALL_NEWS_SOURCES.slice(0, 10);
  }

  // Per-category image pool so fallbacks strictly use authentic images from the same category
  const categoryImagePool = new Map<string, string[]>();
  const allAuthenticImagesPool: string[] = [];

  // Query sources using pool with max 8 concurrent requests
  const sourceResults = await asyncPool(8, sourcesToQuery, async (source) => {
    // Parallel fetch for source articles and image registry
    const [newsRes, imagesRes] = await Promise.allSettled([
      fetchWithFallback<UpstreamSourceResponse | UpstreamArticleItem[]>(
        `/api/news/${source.id}?page=${page}&limit=${limit}`
      ),
      fetchWithFallback<unknown>(`/api/images/${source.id}`),
    ]);

    const articlesData = newsRes.status === 'fulfilled' ? newsRes.value : null;
    let items: UpstreamArticleItem[] = [];

    if (articlesData) {
      if (Array.isArray(articlesData)) {
        items = articlesData;
      } else if (articlesData.items && Array.isArray(articlesData.items)) {
        items = articlesData.items;
      }
    }

    // Process image registry: can be array, object with .items, or dictionary
    const imageRegistry = imagesRes.status === 'fulfilled' ? imagesRes.value : null;
    const imageMap = new Map<string, string[]>();

    if (imageRegistry) {
      let imageItemsList: unknown[] = [];
      if (Array.isArray(imageRegistry)) {
        imageItemsList = imageRegistry;
      } else if (typeof imageRegistry === 'object') {
        const regObj = imageRegistry as Record<string, unknown>;
        if (Array.isArray(regObj.items)) {
          imageItemsList = regObj.items;
        } else {
          for (const [k, v] of Object.entries(regObj)) {
            if (typeof v === 'string' && isValidImageUrl(v)) {
              imageMap.set(k, [v]);
            } else if (Array.isArray(v)) {
              const valid = v.filter(item => typeof item === 'string' && isValidImageUrl(item));
              if (valid.length > 0) imageMap.set(k, valid);
            }
          }
        }
      }

      for (const imgEntry of imageItemsList) {
        if (!imgEntry || typeof imgEntry !== 'object') continue;
        const entry = imgEntry as Record<string, unknown>;
        const imgUrl = String(entry.imageUrl || entry.url || entry.src || entry.mediaUrl || '').trim();
        if (isValidImageUrl(imgUrl)) {
          const keys = [
            String(entry.id || ''),
            String(entry.slug || ''),
            String(entry.title || ''),
            String(entry.alt || '')
          ].filter(Boolean);

          for (const key of keys) {
            const cur = imageMap.get(key) || [];
            if (!cur.includes(imgUrl)) cur.push(imgUrl);
            imageMap.set(key, cur);
          }
        }
      }
    }

    return {
      source,
      items,
      imageMap,
    };
  });

  const parsedItems: NewsItem[] = [];

  for (const res of sourceResults) {
    if (res.status !== 'fulfilled' || !res.value) continue;
    const { source, items, imageMap } = res.value;

    for (const item of items) {
      if (!item || !item.title) continue;
      const rawTitle = cleanTitle(item.title);
      if (rawTitle.length < 5) continue;

      const rawContent = item.content || item.description || '';
      if (isForbiddenVideoPost(rawTitle, rawContent)) continue;

      // Determine Category
      let effectiveCategory = source.category || 'Notícias Gerais';
      // Editorial source remapping as specified in Parte 5 & 14
      if (source.id === '8281449136684') effectiveCategory = 'Política';
      else if (source.id === '6389841444633' || source.id === '3815913481419') effectiveCategory = 'Esporte';
      else if (source.id === '3422817479195') effectiveCategory = 'Economia';
      else if (source.id === '8833539123215') effectiveCategory = 'Cultura';

      effectiveCategory = fixEncoding(effectiveCategory);

      // Summary
      let summary = item.description || rawContent.replace(/<[^>]+>/g, ' ');
      summary = removeTruncationMarkers(cleanFullNewsText(summary));
      if (summary.length > 260) {
        summary = summary.substring(0, 260).replace(/\s+[^\s]*$/, '') + '…';
      }
      summary = fixEncoding(summary);

      // Content HTML
      const contentHtml = fixEncoding(
        ensureCompleteArticleText(
          item.content ? item.content.split(/\n\n+/).map(p => `<p>${cleanFullNewsText(p)}</p>`).join('') : summary,
          rawTitle,
          effectiveCategory
        )
      );

      // Collect Images for Article:
      // order: item.imageUrl -> registry /api/images/{id} -> <img> & <figure> from content -> og:image
      const images: string[] = [];
      const addImage = (u?: string) => {
        if (isValidImageUrl(u) && !images.includes(u!)) {
          images.push(u!);
          const pool = categoryImagePool.get(effectiveCategory) || [];
          if (!pool.includes(u!)) pool.push(u!);
          categoryImagePool.set(effectiveCategory, pool);
          if (!allAuthenticImagesPool.includes(u!)) allAuthenticImagesPool.push(u!);
        }
      };

      if (item.imageUrl) addImage(item.imageUrl);
      if (item.mediaUrl) addImage(item.mediaUrl);

      // Check imageMap
      const lookupKeys = [
        String(item.id || ''),
        String(item.slug || ''),
        item.title || '',
        item.alt || '',
      ].filter(Boolean);

      for (const k of lookupKeys) {
        const found = imageMap.get(k);
        if (found) {
          found.forEach(addImage);
        }
      }

      // Content images
      extractImagesFromContent(item.content).forEach(addImage);

      // Author sanitization: numeric or empty -> "Norma Jurídica"
      let author = (item.author || '').trim();
      if (!author || /^\d+$/.test(author) || /admin|redacao|portal/i.test(author)) {
        author = 'Norma Jurídica';
      }
      author = fixEncoding(author);

      const itemIdStr = String(item.id || item.slug || rawTitle);
      const slug = slugify(rawTitle, itemIdStr);
      const pubDate = item.pubDate || new Date().toISOString();

      parsedItems.push({
        id: slug,
        slug,
        title: fixEncoding(rawTitle),
        link: `/noticia/${slug}`,
        pubDate,
        isoDate: pubDate,
        timeAgo: formatTimeAgo(pubDate),
        category: effectiveCategory,
        categoryId: categorySlugify(effectiveCategory),
        source: 'Norma Jurídica',
        summary,
        contentHtml,
        imageUrl: images[0] || '',
        images,
        imageCaption: fixEncoding(item.alt || `Registro jornalístico editorial • ${effectiveCategory}`),
        author,
        originalCategory: source.category,
      });
    }
  }

  // Fallback for articles without images: borrow strictly from the SAME category's image pool or allAuthenticImagesPool
  for (const item of parsedItems) {
    if (!item.imageUrl || item.images?.length === 0) {
      const sameCategoryImages = categoryImagePool.get(item.category) || [];
      const borrowed = sameCategoryImages.find(img => isValidImageUrl(img)) || allAuthenticImagesPool.find(img => isValidImageUrl(img));
      const fallbackImg = borrowed || '/cover.png';
      item.imageUrl = fallbackImg;
      item.images = [fallbackImg];
    }
  }

  // Deduplication by title (lowercase, trimmed)
  const seenTitles = new Set<string>();
  let uniqueItems: NewsItem[] = [];

  for (const item of parsedItems) {
    const key = item.title.toLowerCase().trim();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      uniqueItems.push(item);
    }
  }

  // Textual search query filtering if requested
  if (searchQuery) {
    uniqueItems = uniqueItems.filter(
      item =>
        item.title.toLowerCase().includes(searchQuery) ||
        item.summary.toLowerCase().includes(searchQuery) ||
        item.category.toLowerCase().includes(searchQuery) ||
        (item.author && item.author.toLowerCase().includes(searchQuery))
    );
  }

  // Order descending by date
  uniqueItems.sort((a, b) => {
    const dateA = new Date(a.isoDate || a.pubDate).getTime() || 0;
    const dateB = new Date(b.isoDate || b.pubDate).getTime() || 0;
    return dateB - dateA;
  });

  // When viewing all categories, interleave news across distinct categories so the first 10 items
  // (the highlights slider) and all subsequent cards contemplate ALL categories in balanced rotation
  if ((!category || category === 'all' || category === 'todas') && !searchQuery && uniqueItems.length > 0) {
    const categoryBuckets = new Map<string, NewsItem[]>();
    for (const item of uniqueItems) {
      const cat = item.category || 'Gerais';
      const list = categoryBuckets.get(cat) || [];
      list.push(item);
      categoryBuckets.set(cat, list);
    }

    const interleaved: NewsItem[] = [];
    const catKeys = Array.from(categoryBuckets.keys());

    // Rotate or prioritize so diverse topics (Justiça, Economia, Política, Educação, Esporte, Regiões) are represented
    const priorityCategories = [
      'Justiça', 'Economia', 'Política', 'Educação', 'Esporte',
      'Tocantins', 'Goiás', 'Santa Catarina', 'Tecnologia & Games',
      'Pará', 'Paraná', 'Mundo', 'Cultura', 'Finanças'
    ];

    catKeys.sort((a, b) => {
      const idxA = priorityCategories.indexOf(a);
      const idxB = priorityCategories.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    let hasMore = true;
    let round = 0;
    while (hasMore) {
      hasMore = false;
      for (const cat of catKeys) {
        const bucket = categoryBuckets.get(cat)!;
        if (round < bucket.length) {
          interleaved.push(bucket[round]);
          hasMore = true;
        }
      }
      round++;
    }

    if (interleaved.length > 0) {
      uniqueItems = interleaved;
    }
  }

  // Strict Category Isolation: when a specific category is requested, strictly filter uniqueItems
  if (category && category !== 'all' && category !== 'todas') {
    const reqNorm = normalizeCategoryText(category);
    const reqDisplayName = resolveCategoryDisplayName(category);
    const reqCatSlug = categorySlugify(reqDisplayName);

    uniqueItems = uniqueItems.filter(item => {
      const itemNorm = normalizeCategoryText(item.category);
      const itemOrigNorm = normalizeCategoryText(item.originalCategory || '');
      const itemCatId = item.categoryId || categorySlugify(item.category);
      return (
        itemNorm === reqNorm ||
        itemOrigNorm === reqNorm ||
        itemCatId === reqCatSlug ||
        itemNorm.includes(reqNorm) ||
        reqNorm.includes(itemNorm)
      );
    });
  }

  // Update in-memory index for O(1) resolution
  for (const item of uniqueItems) {
    newsIndex.set(item.slug, item);
    newsIndex.set(item.id, item);
  }

  // Cache results
  memoryCache.set(cacheKey, {
    items: uniqueItems,
    timestamp: Date.now(),
  });

  return {
    items: uniqueItems,
    total: uniqueItems.length,
    isRealTime: true,
  };
}

export async function getNewsItemBySlugOrId(slugOrId: string): Promise<NewsItem | null> {
  if (!slugOrId) return null;

  // 1. Exact match in index
  if (newsIndex.has(slugOrId)) {
    return newsIndex.get(slugOrId)!;
  }

  // 2. Approximate match in index
  const cleanTarget = slugify(slugOrId);
  for (const [key, item] of newsIndex.entries()) {
    if (key.includes(cleanTarget) || cleanTarget.includes(key)) {
      return item;
    }
  }

  // 3. Search across all memory cache entries
  for (const entry of memoryCache.values()) {
    const found = entry.items.find(
      i => i.slug === slugOrId || i.id === slugOrId || slugify(i.title) === cleanTarget
    );
    if (found) {
      newsIndex.set(slugOrId, found);
      return found;
    }
  }

  // 4. Reload home to populate cache & index
  const { items } = await fetchNews({ category: 'all', refresh: true });
  const matched = items.find(
    i => i.slug === slugOrId || i.id === slugOrId || slugify(i.title) === cleanTarget
  );
  if (matched) {
    newsIndex.set(slugOrId, matched);
    return matched;
  }

  return null;
}

