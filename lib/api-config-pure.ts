export const DEFAULT_NEWS_API_BASE_URL = 'https://news-sources-api.legislativemunicipal.workers.dev';

function cleanEnvString(val?: string): string {
  if (!val) return '';
  let s = String(val).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function normalizeNewsApiBaseUrl(raw?: string): string {
  let cleaned = cleanEnvString(raw).replace(/\/+$/, '');
  if (!cleaned) return DEFAULT_NEWS_API_BASE_URL;
  cleaned = cleaned.replace(/\/api$/i, '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  try {
    const parsed = new URL(cleaned);
    if (parsed.hostname.toLowerCase() === 'workers.dev') {
      return DEFAULT_NEWS_API_BASE_URL;
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, '');
  } catch {
    return DEFAULT_NEWS_API_BASE_URL;
  }
}

export function resolveNewsApiConfig(env: NodeJS.ProcessEnv = process.env) {
  const e = env as Record<string, string | undefined>;
  const rawBaseUrl =
    e.NEWS_API_BASE_URL ||
    e.API_URL_BASE ||
    e.API_BASE_URL ||
    e.NEWS_API_URL ||
    e.NEXT_PUBLIC_NEWS_API_BASE_URL ||
    e.NEXT_PUBLIC_API_BASE_URL ||
    e.api_url_base ||
    e.news_api_base_url ||
    '';
  const baseUrl = normalizeNewsApiBaseUrl(rawBaseUrl);

  // Lê exclusivamente das variáveis de ambiente do servidor (nunca inline no código)
  let apiKey = cleanEnvString(
    e.API_KEY ||
      e.NEWS_API_KEY ||
      e.APIKEY ||
      e.NEWS_SOURCES_API_KEY ||
      e.X_API_KEY ||
      e.API_SECRET_KEY ||
      e.NEXT_PUBLIC_API_KEY ||
      e.NEXT_PUBLIC_NEWS_API_KEY ||
      e.api_key ||
      e.news_api_key ||
      e.apikey ||
      e.x_api_key ||
      ''
  );
  if (/^bearer\s+/i.test(apiKey)) {
    apiKey = apiKey.replace(/^bearer\s+/i, '').trim();
  }

  return {
    baseUrl,
    apiKey,
    endpoints: {
      news: '/api/news',
      newsCategory: (cat: string) => `/api/news/category/${encodeURIComponent(cat)}`,
      newsItem: (id: string) => `/api/news/${encodeURIComponent(id)}`,
      images: '/api/images',
      imageItem: (id: string) => `/api/images/${encodeURIComponent(id)}`,
      categories: '/api/categories',
      types: '/api/types',
      stats: '/api/stats',
      openapi: '/api/openapi.json',
    },
  };
}

export function buildNewsApiHeaders(apiKey: string, siteUrl?: string): Record<string, string> {
  const effectiveSite = cleanEnvString(siteUrl) || 'https://news.mirandinhacontabilidade.workers.dev';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': `NormaJuridica/1.0 (+${effectiveSite})`,
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }

  return headers;
}

