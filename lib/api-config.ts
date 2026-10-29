// lib/api-config.ts (somente servidor)
import 'server-only';

// Constante única inline conforme especificado na Parte 14 (deixar '', para o usuário colar a chave caso queira)
export const NEWS_API_KEY_INLINE = '';

export function getNewsApiConfig() {
  const baseUrl = (process.env.NEWS_API_BASE_URL || '').trim() || 'https://news-sources-api.vercel.app';
  const fallbackUrl = (process.env.NEWS_API_FALLBACK_URL || '').trim() || 'https://news-sources-api.vercel.app';
  
  // Lê process.env.NEWS_API_KEY; se vazia, usa a constante única NEWS_API_KEY_INLINE
  const apiKey = (process.env.NEWS_API_KEY || '').trim() || NEWS_API_KEY_INLINE;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    fallbackUrl: fallbackUrl.replace(/\/+$/, ''),
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

export function getNewsApiHeaders(): Record<string, string> {
  const { apiKey } = getNewsApiConfig();
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
