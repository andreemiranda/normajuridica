import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/site-config';
import { fetchNews } from '@/lib/news-fetcher';
import { renderSitemapHtml, SitemapEntry } from '@/lib/sitemap-viewer';

export const dynamic = 'force-dynamic';

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const acceptHeader = req.headers.get('accept') || '';

  const { items } = await fetchNews({ category: 'all', limit: 2000 });

  const entries: SitemapEntry[] = items
    .filter(item => item.imageUrl || (item.images && item.images.length > 0))
    .map(item => {
      const rawImages = item.images && item.images.length > 0 ? item.images : [item.imageUrl].filter(Boolean) as string[];
      const itemImages = rawImages.map(img => ({
        loc: img.startsWith('http') ? img : `${baseUrl}${img.startsWith('/') ? '' : '/'}${img}`,
        title: item.title,
        caption: item.imageCaption || `Registro editorial Norma Jurídica • ${item.category}`,
      }));

      return {
        url: `${baseUrl}/noticia/${item.slug}`,
        title: item.title,
        lastmod: item.isoDate || item.pubDate || new Date().toISOString(),
        changefreq: 'hourly',
        priority: '0.8',
        images: itemImages,
      };
    });

  if (acceptHeader.includes('text/html')) {
    const html = renderSitemapHtml({
      title: 'Sitemap de Imagens e Registros Visuais',
      description: `Acervo fotográfico e registros editoriais com ${entries.length} matérias ilustradas no portal Norma Jurídica.`,
      entries,
      type: 'images',
    });
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries
  .map(
    e => `  <url>
    <loc>${escapeXml(e.url)}</loc>
    <lastmod>${escapeXml(e.lastmod || '')}</lastmod>
    <changefreq>${escapeXml(e.changefreq || 'hourly')}</changefreq>
    <priority>${escapeXml(String(e.priority || '0.8'))}</priority>
${(e.images || [])
  .map(
    img => `    <image:image>
      <image:loc>${escapeXml(img.loc)}</image:loc>
      <image:title>${escapeXml(img.title || '')}</image:title>
      <image:caption>${escapeXml(img.caption || '')}</image:caption>
    </image:image>`
  )
  .join('\n')}
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
