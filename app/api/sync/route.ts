import { NextRequest, NextResponse } from 'next/server';
import { clearNewsCache, fetchNews } from '@/lib/news-fetcher';
import { sanitizePublicData } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get('action');
  const format = searchParams.get('format') || 'json';

  const startTime = Date.now();
  let syncResult: { total: number; latestTitle: string } = { total: 0, latestTitle: '' };

  if (action === 'sync') {
    clearNewsCache();
    const fresh = await fetchNews({ category: 'all', refresh: true });
    syncResult = {
      total: fresh.total,
      latestTitle: fresh.items[0]?.title || 'Nenhuma notícia retornada',
    };
  }

  const latencyMs = Date.now() - startTime;

  if (format === 'html') {
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Sincronização • Norma Jurídica</title>
        <style>
          body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; }
          .card { background: #1e293b; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #334155; }
          h1 { color: #60a5fa; margin-top: 0; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; background: #1d4ed8; color: #fff; font-size: 13px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Sincronização Norma Jurídica</h1>
          <p><span class="badge">Status: Operacional</span></p>
          <p><strong>Ação:</strong> ${action || 'consulta'}</p>
          <p><strong>Latência:</strong> ${latencyMs} ms</p>
          <p><strong>Total de matérias processadas:</strong> ${syncResult.total}</p>
          <p><strong>Última matéria:</strong> ${syncResult.latestTitle}</p>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Timestamp: ${new Date().toISOString()}</p>
        </div>
      </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  return NextResponse.json(
    sanitizePublicData({
      status: 'success',
      action: action || 'status',
      latencyMs,
      total: syncResult.total,
      latestTitle: syncResult.latestTitle,
      timestamp: new Date().toISOString(),
    })
  );
}
