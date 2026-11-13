import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/site-config';
import { renderSitemapHtml, SitemapEntry } from '@/lib/sitemap-viewer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const baseUrl = getBaseUrl(req);
  const acceptHeader = req.headers.get('accept') || '';
  const now = new Date().toISOString();

  const entries: SitemapEntry[] = [
    { url: `${baseUrl}/`, title: 'Página Inicial', changefreq: 'always', priority: '1.0', lastmod: now },
    { url: `${baseUrl}/noticia`, title: 'Sala de Imprensa & Últimas Notícias', changefreq: 'always', priority: '0.9', lastmod: now },
    { url: `${baseUrl}/categoria`, title: 'Guia Editorial & Editorias', changefreq: 'hourly', priority: '0.9', lastmod: now },
    { url: `${baseUrl}/pagina`, title: 'Índice de Páginas Institucionais', changefreq: 'weekly', priority: '0.8', lastmod: now },
    { url: `${baseUrl}/pagina/editorial`, title: 'Editorial e Compromisso Jornalístico', changefreq: 'monthly', priority: '0.8', lastmod: now },
    { url: `${baseUrl}/pagina/expediente`, title: 'Expediente e Corpo Editorial', changefreq: 'monthly', priority: '0.8', lastmod: now },
    { url: `${baseUrl}/pagina/fale-conosco`, title: 'Fale Conosco e Atendimento', changefreq: 'monthly', priority: '0.8', lastmod: now },
    { url: `${baseUrl}/pagina/linha-editorial`, title: 'Linha Editorial e Princípios Éticos', changefreq: 'monthly', priority: '0.8', lastmod: now },
    { url: `${baseUrl}/pagina/cadastro-certo`, title: 'Cadastro Certo e Alertas', changefreq: 'monthly', priority: '0.7', lastmod: now },
    { url: `${baseUrl}/pagina/sobre-a-prefeitura`, title: 'Sobre a Administração Pública', changefreq: 'monthly', priority: '0.7', lastmod: now },
    { url: `${baseUrl}/pagina/transparencia`, title: 'Transparência e Governança', changefreq: 'monthly', priority: '0.7', lastmod: now },
    { url: `${baseUrl}/pagina/ouvidoria`, title: 'Ouvidoria Geral e Atendimento', changefreq: 'monthly', priority: '0.7', lastmod: now },
    { url: `${baseUrl}/pagina/gestao-publica-municipal`, title: 'Gestão Pública Municipal', changefreq: 'monthly', priority: '0.7', lastmod: now },
    { url: `${baseUrl}/contato`, title: 'Contato da Redação e Atendimento', changefreq: 'monthly', priority: '0.8', lastmod: now },
    { url: `${baseUrl}/privacidade`, title: 'Política de Privacidade', changefreq: 'monthly', priority: '0.7', lastmod: now },
    { url: `${baseUrl}/termos`, title: 'Termos e Condições de Uso', changefreq: 'monthly', priority: '0.7', lastmod: now },
    { url: `${baseUrl}/cookies`, title: 'Política e Gestão de Cookies', changefreq: 'monthly', priority: '0.7', lastmod: now },
  ];

  if (acceptHeader.includes('text/html')) {
    const html = renderSitemapHtml({
      title: 'Sitemap de Páginas Institucionais e Governança',
      description: 'Estrutura institucional completa do portal Norma Jurídica.',
      entries,
      type: 'pages',
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
