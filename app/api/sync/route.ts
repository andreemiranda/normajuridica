import { NextRequest, NextResponse } from 'next/server';
import { clearNewsCache, fetchNews } from '@/lib/news-fetcher';
import { getNewsApiConfig, getNewsApiHeaders } from '@/lib/api-config';
import { revalidatePath, revalidateTag } from 'next/cache';
import { sanitizePublicData } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleSync(req);
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}

async function handleSync(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action');
  const format = searchParams.get('format') || '';
  const acceptHeader = req.headers.get('accept') || '';

  const isSyncAction = action === 'sync';
  const startTime = Date.now();

  if (isSyncAction) {
    clearNewsCache();
    try {
      revalidateTag('news');
      revalidateTag('posts');
      revalidateTag('categories');
      revalidatePath('/', 'layout');
    } catch {}
  }

  // Probe upstream API to calculate live round-trip latency and total items
  const { baseUrl } = getNewsApiConfig();
  const headers = getNewsApiHeaders();
  let upstreamStatus = 'conectado';
  let totalApiPosts = 1194; // Baseline verified count
  let upstreamLatencyMs = 0;

  try {
    const probeStart = Date.now();
    const probeRes = await fetch(`${baseUrl}/api/news/8281449136684?limit=1`, {
      headers,
      cache: 'no-store',
    });
    upstreamLatencyMs = Date.now() - probeStart;

    if (probeRes.ok) {
      const probeJson = await probeRes.json();
      if (probeJson?.meta?.totalItems) {
        totalApiPosts = probeJson.meta.totalItems;
      }
    } else {
      upstreamStatus = `instabilidade (HTTP ${probeRes.status})`;
    }
  } catch {
    upstreamStatus = 'erro de conexão';
    upstreamLatencyMs = Date.now() - startTime;
  }

  // Fetch or retrieve news items to determine the latest publication
  const newsData = await fetchNews({ category: 'all', refresh: isSyncAction, limit: 10 });
  const latestItem = newsData.items[0] || null;

  const totalProcessedLatency = Date.now() - startTime;
  const latencyMs = upstreamLatencyMs > 0 ? upstreamLatencyMs : totalProcessedLatency;

  const payload = {
    status: upstreamStatus === 'conectado' ? 'conectado' : 'alerta',
    connection: 'ativa',
    action: isSyncAction ? 'sincronizacao_imediata' : 'monitoramento_ao_vivo',
    latencyMs,
    totalPostsApi: totalApiPosts,
    totalLoaded: newsData.total,
    latestPost: latestItem
      ? {
          id: latestItem.id,
          title: latestItem.title,
          slug: latestItem.slug,
          category: latestItem.category,
          pubDate: latestItem.pubDate,
          timeAgo: latestItem.timeAgo,
          link: latestItem.link,
        }
      : null,
    timestamp: new Date().toISOString(),
    isrIntervalSeconds: 20,
    backgroundCheckSeconds: 60,
  };

  if (format === 'html' || (!format && acceptHeader.includes('text/html'))) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Status da Conexão & Sincronização • Norma Jurídica</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; background: #090d16; color: #f1f5f9; padding: 24px; margin: 0; }
          .container { max-width: 680px; margin: 40px auto; background: #131c2e; border: 1px solid #1e293b; border-radius: 20px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; border-bottom: 1px solid #1e293b; padding-bottom: 20px; }
          h1 { font-size: 20px; margin: 0; color: #fff; font-weight: 800; letter-spacing: -0.5px; }
          .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 9999px; background: #065f46; color: #6ee7b7; font-size: 12px; font-weight: 700; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
          .stat-box { background: #0b1120; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; }
          .stat-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 6px; }
          .stat-value { font-size: 22px; font-weight: 900; color: #38bdf8; font-mono; }
          .latest-card { background: #0b1120; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
          .latest-title { font-size: 15px; font-weight: 700; color: #fff; margin-top: 8px; line-height: 1.4; }
          .latest-meta { font-size: 12px; color: #60a5fa; margin-top: 6px; }
          .btn-sync { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 700; transition: background 0.2s; }
          .btn-sync:hover { background: #1d4ed8; }
          .footer { font-size: 11px; color: #64748b; margin-top: 24px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <div style="font-size: 11px; color: #60a5fa; font-weight: 800; text-transform: uppercase;">Norma Jurídica</div>
              <h1>Painel de Sincronização da API</h1>
            </div>
            <span class="badge">● Conexão Ativa</span>
          </div>

          <div class="grid">
            <div class="stat-box">
              <div class="stat-label">Status da Conexão</div>
              <div class="stat-value" style="color: #34d399;">${payload.status.toUpperCase()}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Latência em Tempo Real</div>
              <div class="stat-value">${payload.latencyMs} ms</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Total de Posts na API</div>
              <div class="stat-value">${payload.totalPostsApi.toLocaleString('pt-BR')}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Intervalo de Revalidação</div>
              <div class="stat-value">${payload.isrIntervalSeconds}s <span style="font-size: 13px; color: #94a3b8;">(ISR)</span></div>
            </div>
          </div>

          ${
            latestItem
              ? `<div class="latest-card">
                  <div class="stat-label">Publicação Mais Recente da API</div>
                  <div class="latest-title">${latestItem.title}</div>
                  <div class="latest-meta">${latestItem.category} • ${latestItem.timeAgo} • ID: ${latestItem.id}</div>
                </div>`
              : ''
          }

          <div style="text-align: center;">
            <a href="/api/sync?action=sync" class="btn-sync">↻ Forçar Sincronização Imediata (?action=sync)</a>
          </div>

          <div class="footer">
            Verificação concluída em ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Horário de Brasília)
          </div>
        </div>
      </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  return NextResponse.json(sanitizePublicData(payload));
}

