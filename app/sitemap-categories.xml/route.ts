import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/site-config';
import { ALL_CATEGORIES } from '@/lib/sources';
import { renderSitemapHtml, SitemapEntry } from '@/lib/sitemap-viewer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const acceptHeader = req.headers.get('accept') || '';
  const now = new Date().toISOString();

  const entries: SitemapEntry[] = ALL_CATEGORIES.map(cat => ({
    url: `${baseUrl}/categoria/${cat.slug}`,
    title: cat.name,
    lastmod: now,
    changefreq: 'hourly',
    priority: cat.highlight ? '0.9' : '0.8',
  }));

  if (acceptHeader.includes('text/html')) {
    const html = renderSitemapHtml({
      title: 'Sitemap de Editorias e Categorias',
      description: 'Catálogo de todas as 54 seções editoriais oficiais do portal Norma Jurídica.',
      entries,
      type: 'categories',
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
