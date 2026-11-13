// lib/api-config.ts (somente servidor)
import 'server-only';
import {
  DEFAULT_NEWS_API_BASE_URL,
  resolveNewsApiConfig,
  buildNewsApiHeaders,
} from './api-config-pure';

export { DEFAULT_NEWS_API_BASE_URL, resolveNewsApiConfig, buildNewsApiHeaders };

export function getNewsApiConfig() {
  return resolveNewsApiConfig(process.env);
}

export function getNewsApiHeaders(): Record<string, string> {
  const { apiKey } = getNewsApiConfig();
  return buildNewsApiHeaders(apiKey);
}
