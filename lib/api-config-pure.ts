export const DEFAULT_NEWS_API_BASE_URL = 'https://news-sources-api.legislativemunicipal.workers.dev';

function cleanEnvString(val?: string): string {
  if (!val) return '';
  let s = String(val).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const NEWS_API_KEY_ALIASES = [
  'API_KEY',
  'NEWS_API_KEY',
  'APIKEY',
  'NEWS_SOURCES_API_KEY',
  'X_API_KEY',
  'API_SECRET_KEY',
  'API_TOKEN',
  'NEWS_API_TOKEN',
  'NEWS_SOURCES_API_TOKEN',
  'API_SECRET',
  'NEWS_API_SECRET',
  'ACCESS_TOKEN',
  'BEARER_TOKEN',
  'NEWS_KEY',
  'KEY_API',
  'CHAVE_API',
  'NEWS_SOURCES_KEY',
  'AUTHORIZATION_TOKEN',
  'AUTH_TOKEN',
  'NEXT_PUBLIC_API_KEY',
  'NEXT_PUBLIC_NEWS_API_KEY',
  'NEXT_PUBLIC_API_TOKEN',
  'NEXT_PUBLIC_NEWS_API_TOKEN',
];

function readEnvCaseInsensitive(env: Record<string, string | undefined>, keys: string[]): string {
  for (const key of keys) {
    const val = cleanEnvString(env[key]);
    if (val) return val;
  }
  const lowerMap = new Map<string, string>();
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined && v !== null) {
      lowerMap.set(String(k).trim().toLowerCase(), v);
    }
  }
  for (const key of keys) {
    const val = cleanEnvString(lowerMap.get(key.toLowerCase()));
    if (val) return val;
  }
  return '';
}

function parseNewsApiBaseUrl(raw?: string): { baseUrl: string; embeddedKey: string } {
  let cleaned = cleanEnvString(raw).replace(/\/+$/, '');
  if (!cleaned) return { baseUrl: DEFAULT_NEWS_API_BASE_URL, embeddedKey: '' };
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  try {
    const parsed = new URL(cleaned);
    const embeddedKey = cleanEnvString(
      parsed.searchParams.get('ref') ||
        parsed.searchParams.get('key') ||
        parsed.searchParams.get('token') ||
        parsed.searchParams.get('api_key') ||
        parsed.searchParams.get('apikey') ||
        ''
    );
    if (parsed.hostname.toLowerCase() === 'workers.dev') {
      return { baseUrl: DEFAULT_NEWS_API_BASE_URL, embeddedKey };
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, '').replace(/\/api$/i, '').replace(/\/+$/, '');
    return { baseUrl: parsed.origin + cleanPath, embeddedKey };
  } catch {
    return { baseUrl: DEFAULT_NEWS_API_BASE_URL, embeddedKey: '' };
  }
}

export function resolveNewsApiConfig(env: NodeJS.ProcessEnv = process.env) {
  const e = env as Record<string, string | undefined>;
  const rawBaseUrl = readEnvCaseInsensitive(e, [
    'NEWS_API_BASE_URL',
    'API_URL_BASE',
    'API_BASE_URL',
    'NEWS_API_URL',
    'NEXT_PUBLIC_NEWS_API_BASE_URL',
    'NEXT_PUBLIC_API_BASE_URL',
  ]);
  const { baseUrl, embeddedKey } = parseNewsApiBaseUrl(rawBaseUrl);

  // Lê exclusivamente das variáveis de ambiente do servidor (nunca inline no código)
  let apiKey = readEnvCaseInsensitive(e, NEWS_API_KEY_ALIASES) || embeddedKey;
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

