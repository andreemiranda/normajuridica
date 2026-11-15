import { NextRequest, NextResponse } from 'next/server';
import { fetchNews } from '@/lib/news-fetcher';
import { sanitizePublicData, checkRateLimit, sanitizeInput, getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rateLimit = checkRateLimit(`news:${clientIp}`, 90, 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        sanitizePublicData({ error: 'Muitas requisições. Tente novamente em instantes.', items: [] }),
        { status: 429, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const category = sanitizeInput(searchParams.get('category'), 80) || undefined;
    const sourceId = sanitizeInput(searchParams.get('sourceId'), 64) || undefined;
    const q = sanitizeInput(searchParams.get('q'), 120) || undefined;
    const refresh = searchParams.get('refresh') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '12', 10) || 12), 100);

    const result = await fetchNews({
      category,
      sourceId,
      searchQuery: q,
      page,
      limit,
      refresh,
    });

    const totalPages = Math.ceil(result.total / limit);

    const response = {
      items: result.items,
      source: result.fromStore ? 'sqlite_local_store' : 'upstream',
      total: result.total,
      page,
      limit,
      totalPages,
      isRealTime: result.isRealTime,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(sanitizePublicData(response), {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      sanitizePublicData({ error: 'Erro interno ao processar notícias.', items: [] }),
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
