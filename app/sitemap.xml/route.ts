import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/site-config';
import { renderSitemapHtml, SitemapEntry } from '@/lib/sitemap-viewer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const acceptHeader = req.headers.get('accept') || '';

  const subSitemaps: SitemapEntry[] = [
    {
      url: `${baseUrl}/sitemap-posts.xml`,
      changefreq: 'hourly',
      priority: '1.0',
      title: 'Sitemap de Matérias e Reportagens',
      lastmod: new Date().toISOString(),
    },
    {
      url: `${baseUrl}/sitemap-categories.xml`,
      changefreq: 'hourly',
      priority: '0.9',
      title: 'Sitemap de Editorias e Categorias Temáticas',
      lastmod: new Date().toISOString(),
    },
    {
      url: `${baseUrl}/sitemap-pages.xml`,
      changefreq: 'weekly',
      priority: '0.8',
      title: 'Sitemap de Páginas Institucionais e Governança',
      lastmod: new Date().toISOString(),
    },
    {
      url: `${baseUrl}/sitemap-images.xml`,
      changefreq: 'hourly',
      priority: '0.8',
      title: 'Sitemap de Acervo Fotográfico e Imagens Editoriais',
      lastmod: new Date().toISOString(),
    },
  ];

  if (acceptHeader.includes('text/html')) {
    const html = renderSitemapHtml({
      title: 'Índice Geral de Sitemaps XML',
      description: 'Mapa de indexação estruturada para robôs de busca e indexadores mundiais.',
      entries: subSitemaps,
      type: 'index',
    });
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${subSitemaps
  .map(
    s => `  <sitemap>
    <loc>${s.url}</loc>
    <lastmod>${s.lastmod}</lastmod>
  </sitemap>`
  )
  .join('\n')}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
