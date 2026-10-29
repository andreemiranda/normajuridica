import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/site-config';
import { fetchNews } from '@/lib/news-fetcher';
import { renderSitemapHtml, SitemapEntry } from '@/lib/sitemap-viewer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const acceptHeader = req.headers.get('accept') || '';

  const { items } = await fetchNews({ category: 'all', limit: 50 });

  const entries: SitemapEntry[] = items.map(item => ({
    url: `${baseUrl}/noticia/${item.slug}`,
    title: item.title,
    lastmod: item.isoDate || item.pubDate || new Date().toISOString(),
    changefreq: 'hourly',
    priority: '1.0',
  }));

  if (acceptHeader.includes('text/html')) {
    const html = renderSitemapHtml({
      title: 'Sitemap de Matérias e Reportagens',
      description: 'Listagem canônica de todas as notícias ativas no portal Norma Jurídica.',
      entries,
      type: 'posts',
    });
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    e => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
