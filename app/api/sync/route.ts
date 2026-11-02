// app/api/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getNewsStore } from '@/lib/news-store';
import { syncNewsSources } from '@/lib/news-sync';
import { getNewsApiConfig } from '@/lib/api-config';
import { sanitizePublicData } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleSyncRequest(req);
}

export async function POST(req: NextRequest) {
  return handleSyncRequest(req);
}

async function handleSyncRequest(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action') || 'status';
  const format = searchParams.get('format') || '';
  const acceptHeader = req.headers.get('accept') || '';

  const store = getNewsStore();
  await store.init();

  const startTime = Date.now();
  let syncResult = null;
  let pruneResult = null;

  // 1. Action: Force synchronization
  if (action === 'sync') {
    syncResult = await syncNewsSources({ force: true });
  }

  // 2. Action: Force prune (for testing FIFO rotation and retention)
  if (action === 'prune') {
    pruneResult = await store.prune();
  }

  // 3. Action: Export JSON backup
  if (action === 'export') {
    const backupItems = await store.exportBackup();
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      total: backupItems.length,
      items: backupItems,
    });
  }

  // Query store state
  const totalInDb = await store.count();
  const syncMeta = await store.getSyncMetadata();
  const dbLoc = store.getDbLocation();
  const { items: latestList } = await store.getNews({ limit: 1, order: 'DESC' });
  const latestItem = latestList[0] || null;

  // Upstream probe to check connectivity & latency
  const { baseUrl } = getNewsApiConfig();
  let upstreamLatencyMs = 0;
  let upstreamStatus = 'conectado';

  try {
    const probeStart = Date.now();
    const probeRes = await fetch(`${baseUrl}/api/types`, { cache: 'no-store' });
    upstreamLatencyMs = Date.now() - probeStart;
    if (!probeRes.ok) upstreamStatus = `alerta (HTTP ${probeRes.status})`;
  } catch {
    upstreamStatus = 'offline / instável (servindo do SQLite)';
    upstreamLatencyMs = 0;
  }

  const durationMs = Date.now() - startTime;

  const maxItems = parseInt(process.env.NEWS_STORE_MAX_ITEMS || '5000', 10);
  const maxPerSource = parseInt(process.env.NEWS_STORE_MAX_PER_SOURCE || '100', 10);
  const retentionDays = parseInt(process.env.NEWS_RETENTION_DAYS || '30', 10);
  const syncIntervalSec = parseInt(process.env.NEWS_SYNC_INTERVAL_SECONDS || '60', 10);

  const payload = {
    status: 'conectado',
    connection: 'ativa',
    actionExecuted: action,
    storage: {
      engine: 'SQLite (better-sqlite3)',
      databasePath: dbLoc.path,
      isEphemeral: dbLoc.isEphemeral,
      totalStored: totalInDb,
      capacity: {
        maxItems,
        maxPerSource,
        retentionDays,
        syncIntervalSeconds: syncIntervalSec,
      },
    },
    sync: {
      lastSyncAt: syncMeta?.lastSyncAt || 'Nunca',
      lastSyncStatus: syncMeta?.lastSyncStatus || 'pendente',
      durationMs: syncMeta?.lastSyncDurationMs || 0,
      sourcesSynced: syncMeta?.sourcesSynced || 0,
      totalSources: syncMeta?.totalSources || 77,
      itemsSynced: syncMeta?.itemsSynced || 0,
      itemsInserted: syncMeta?.itemsInserted || 0,
      itemsUpdated: syncMeta?.itemsUpdated || 0,
    },
    upstream: {
      status: upstreamStatus,
      latencyMs: upstreamLatencyMs,
      endpoint: baseUrl,
    },
    latestPostInStore: latestItem
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
    manualActionResult: syncResult || pruneResult || null,
    timestamp: new Date().toISOString(),
    queryDurationMs: durationMs,
  };

  // Render HTML dashboard if requested
  if (format === 'html' || (!format && acceptHeader.includes('text/html'))) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Status da Sincronização & SQLite • Norma Jurídica</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; background: #090d16; color: #f1f5f9; padding: 24px; margin: 0; }
          .container { max-width: 720px; margin: 30px auto; background: #131c2e; border: 1px solid #1e293b; border-radius: 20px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; border-bottom: 1px solid #1e293b; padding-bottom: 20px; }
          h1 { font-size: 20px; margin: 0; color: #fff; font-weight: 800; letter-spacing: -0.5px; }
          .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 9999px; background: #065f46; color: #6ee7b7; font-size: 12px; font-weight: 700; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
          .stat-box { background: #0b1120; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; }
          .stat-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 6px; }
          .stat-value { font-size: 20px; font-weight: 900; color: #38bdf8; font-family: monospace; }
          .card { background: #0b1120; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; margin-bottom: 20px; font-size: 13px; }
          .latest-title { font-size: 15px; font-weight: 700; color: #fff; margin-top: 6px; line-height: 1.4; }
          .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; transition: background 0.2s; margin-right: 8px; }
          .btn:hover { background: #1d4ed8; }
          .btn-secondary { background: #334155; }
          .btn-secondary:hover { background: #475569; }
          .footer { font-size: 11px; color: #64748b; margin-top: 24px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <div style="font-size: 11px; color: #60a5fa; font-weight: 800; text-transform: uppercase;">Norma Jurídica</div>
              <h1>Armazenamento Local & Sincronização</h1>
            </div>
            <span class="badge">● SQLite Ativo</span>
          </div>

          <div class="grid">
            <div class="stat-box">
              <div class="stat-label">Total de Notícias no Banco</div>
              <div class="stat-value" style="color: #34d399;">${payload.storage.totalStored.toLocaleString('pt-BR')}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Capacidade Máxima (FIFO)</div>
              <div class="stat-value">${payload.storage.capacity.maxItems.toLocaleString('pt-BR')} itens</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Limite por Fonte / Retenção</div>
              <div class="stat-value">${payload.storage.capacity.maxPerSource} / ${payload.storage.capacity.retentionDays} dias</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Intervalo de Sincronização</div>
              <div class="stat-value">${payload.storage.capacity.syncIntervalSeconds}s (Segundo Plano)</div>
            </div>
          </div>

          <div class="card">
            <div class="stat-label">Status do Banco de Dados</div>
            <p style="margin: 6px 0;"><strong>Engine:</strong> ${payload.storage.engine}</p>
            <p style="margin: 6px 0;"><strong>Arquivo:</strong> <code style="color: #38bdf8;">${payload.storage.databasePath}</code></p>
            <p style="margin: 6px 0;"><strong>Última Sincronização:</strong> ${payload.sync.lastSyncAt} (${payload.sync.durationMs}ms)</p>
            <p style="margin: 6px 0;"><strong>Fontes Atendidas:</strong> ${payload.sync.sourcesSynced} de ${payload.sync.totalSources} fontes</p>
          </div>

          ${
            latestItem
              ? `<div class="card">
                  <div class="stat-label">Publicação Mais Recente no SQLite</div>
                  <div class="latest-title">${latestItem.title}</div>
                  <div style="color: #60a5fa; margin-top: 6px;">${latestItem.category} • ${latestItem.timeAgo} • ID: ${latestItem.id}</div>
                </div>`
              : ''
          }

          <div style="text-align: center; margin-top: 24px;">
            <a href="/api/sync?action=sync" class="btn">↻ Forçar Sincronização Agora</a>
            <a href="/api/sync?action=prune" class="btn btn-secondary">✂ Testar Rodízio / Prune</a>
          </div>

          <div class="footer">
            Verificação executada em ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Horário de Brasília)
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
