export const DEFAULT_NEWS_API_BASE_URL = 'https://news-sources-api.legislativemunicipal.workers.dev';

export function resolveNewsApiConfig(env: NodeJS.ProcessEnv = process.env) {
  const rawBaseUrl = (env.NEWS_API_BASE_URL || '').trim();
  const baseUrl = (rawBaseUrl || DEFAULT_NEWS_API_BASE_URL).replace(/\/+$/, '');

  // Lê exclusivamente das variáveis de ambiente do servidor (API_KEY ou NEWS_API_KEY), nunca inline no código
  const apiKey = (env.API_KEY || env.NEWS_API_KEY || '').trim();

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

export function buildNewsApiHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'NormaJuridica/1.0 (+https://normajuridica.com.br)',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }

  return headers;
}
