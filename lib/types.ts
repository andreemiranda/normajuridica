export interface NewsItem {
  id: string;
  slug: string;
  title: string;
  link: string;
  pubDate: string;
  isoDate?: string;
  timeAgo: string;
  category: string;
  categoryId?: string;
  source: string;
  summary: string;
  contentHtml?: string;
  imageUrl?: string;
  images?: string[];
  imageCaption?: string;
  author?: string;
  originalCategory?: string;
  isBookmarked?: boolean;
}

export interface FeedSource {
  id: string;
  name: string;
  category: string;
  url: string;
  type?: 'wp-api' | 'rss';
  active?: boolean;
}

export interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  count?: number;
  highlight?: boolean;
  group?: 'nacional' | 'regiao' | 'tema' | 'especial';
}

export interface NewsApiSourceItem {
  id: string;
  endpoint?: string;
  category: string;
  site?: string;
  type?: 'wp-api' | 'rss';
  name?: string;
  active?: boolean;
}

export interface WeatherInfo {
  city: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  condition: string;
  conditionCode?: string;
  uvIndex: number;
  uvDescription: string;
  forecast?: {
    date: string;
    maxTemp: number;
    minTemp: number;
    condition: string;
  }[];
  isFallback?: boolean;
}
