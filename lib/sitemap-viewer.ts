// lib/sitemap-viewer.ts
import { SITE_CONFIG } from './site-config';

export interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string | number;
  title?: string;
  images?: { loc: string; title?: string; caption?: string }[];
}

export function renderSitemapHtml(options: {
  title: string;
  description: string;
  entries: SitemapEntry[];
  type?: 'index' | 'posts' | 'categories' | 'pages' | 'images';
}): string {
  const { title, description, entries, type } = options;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ${SITE_CONFIG.name}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, 'Inter', sans-serif; background: #0f172a; color: #f8fafc; line-height: 1.5; padding: 24px; }
    .container { max-width: 1100px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
    .header { background: linear-gradient(135deg, #1e3a8a, #1d4ed8); padding: 32px; border-bottom: 1px solid #3b82f6; }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .logo-badge { background: #ffffff; color: #1d4ed8; font-weight: 900; font-size: 20px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 10px; }
    .brand-text { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
    .header h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
    .header p { color: #bfdbfe; font-size: 15px; }
    .nav-links { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
    .nav-link { color: #ffffff; background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 9999px; text-decoration: none; font-size: 13px; font-weight: 600; transition: background 0.2s; }
    .nav-link:hover { background: #ffffff; color: #1d4ed8; }
    .table-wrapper { overflow-x: auto; padding: 20px; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
    th { background: #0f172a; color: #94a3b8; font-weight: 600; padding: 12px 16px; border-bottom: 2px solid #334155; }
    td { padding: 12px 16px; border-bottom: 1px solid #334155; color: #cbd5e1; }
    tr:hover td { background: #243248; }
    a.item-link { color: #60a5fa; text-decoration: none; font-weight: 500; word-break: break-all; }
    a.item-link:hover { text-decoration: underline; color: #93c5fd; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; background: #3b82f6; color: #ffffff; }
    .badge-sub { background: #334155; color: #94a3b8; }
    .footer { padding: 20px 32px; background: #0f172a; border-top: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #64748b; }
    @media (max-width: 640px) {
      body { padding: 12px; }
      .header { padding: 20px; }
      .footer { flex-direction: column; gap: 8px; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="logo-badge">NJ</div>
        <div class="brand-text">${SITE_CONFIG.name}</div>
      </div>
      <h1>${title}</h1>
      <p>${description}</p>
      <div class="nav-links">
        <a class="nav-link" href="/sitemap.xml">Índice Geral</a>
        <a class="nav-link" href="/sitemap-posts.xml">Matérias</a>
        <a class="nav-link" href="/sitemap-categories.xml">Editorias</a>
        <a class="nav-link" href="/sitemap-pages.xml">Institucional</a>
        <a class="nav-link" href="/sitemap-images.xml">Imagens</a>
        <a class="nav-link" href="/">Voltar ao Portal</a>
      </div>
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>URL / Recurso</th>
            ${type === 'images' ? '<th>Qtd. Imagens</th>' : ''}
            <th>Frequência</th>
            <th>Prioridade</th>
            <th>Última Atualização</th>
          </tr>
        </thead>
        <tbody>
          ${entries
            .map(
              e => `
            <tr>
              <td>
                <a class="item-link" href="${e.url}">${e.title ? `<strong>${e.title}</strong><br>` : ''}${e.url}</a>
              </td>
              ${type === 'images' ? `<td><span class="badge">${e.images?.length || 0}</span></td>` : ''}
              <td><span class="badge badge-sub">${e.changefreq || 'hourly'}</span></td>
              <td><strong>${e.priority || '0.8'}</strong></td>
              <td>${e.lastmod ? new Date(e.lastmod).toLocaleString('pt-BR') : 'Tempo Real'}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <div class="footer">
      <div>Total de URLs listadas: <strong>${entries.length}</strong></div>
      <div>${SITE_CONFIG.name} • Sistema Oficial de Distribuição XML</div>
    </div>
  </div>
</body>
</html>`;
}
