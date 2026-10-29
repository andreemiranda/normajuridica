// lib/feeds.ts
import { ALL_NEWS_SOURCES } from './sources';
import { FeedSource } from './types';
import { getNewsApiConfig } from './api-config';

export function getDefaultFeeds(): FeedSource[] {
  const { baseUrl } = getNewsApiConfig();
  return ALL_NEWS_SOURCES.map(source => ({
    id: source.id,
    name: source.name || source.category,
    category: source.category,
    url: `${baseUrl}/api/news/${source.id}`,
    type: source.type || 'wp-api',
    active: source.active !== false,
  }));
}

export const DEFAULT_FEEDS = getDefaultFeeds();
