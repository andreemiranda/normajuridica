import { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap-posts.xml`,
      `${baseUrl}/sitemap-categories.xml`,
      `${baseUrl}/sitemap-pages.xml`,
      `${baseUrl}/sitemap-images.xml`,
    ],
  };
}
