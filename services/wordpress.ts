// services/wordpress.ts
import { fetchNews, getNewsItemBySlugOrId } from '@/lib/news-fetcher';
import { ALL_CATEGORIES } from '@/lib/sources';
import { NewsItem, CategoryInfo } from '@/lib/types';
import { INSTITUTIONAL_PAGES, WordPressPage, getGenericPage } from '@/lib/wp';

export class WordPressService {
  static async getPosts(category: string = 'all', page: number = 1, limit: number = 20): Promise<{ items: NewsItem[]; total: number }> {
    const result = await fetchNews({ category, page, limit });
    return {
      items: result.items,
      total: result.total,
    };
  }

  static async getPostBySlug(slug: string): Promise<NewsItem | null> {
    return getNewsItemBySlugOrId(slug);
  }

  static async getCategories(): Promise<CategoryInfo[]> {
    return ALL_CATEGORIES;
  }

  static async getPages(): Promise<WordPressPage[]> {
    return Object.values(INSTITUTIONAL_PAGES);
  }

  static async getPageBySlug(slug: string): Promise<WordPressPage | null> {
    if (INSTITUTIONAL_PAGES[slug]) {
      return INSTITUTIONAL_PAGES[slug];
    }
    return getGenericPage(slug);
  }

  static async getStatus(): Promise<{ status: string; uptime: number; totalCategories: number }> {
    return {
      status: 'operational',
      uptime: process.uptime(),
      totalCategories: ALL_CATEGORIES.length,
    };
  }
}
