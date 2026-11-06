import { NextRequest, NextResponse } from 'next/server';
import { fetchNews } from '@/lib/news-fetcher';
import { sanitizePublicData } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category') || undefined;
    const sourceId = searchParams.get('sourceId') || undefined;
    const q = searchParams.get('q') || undefined;
    const refresh = searchParams.get('refresh') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '12', 10)), 100);

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
  } catch (err: unknown) {
    console.error('API /api/news error details:', err);
    const errorMsg = err instanceof Error ? err.message : 'Erro ao processar notícias';
    return NextResponse.json(
      sanitizePublicData({ error: errorMsg, items: [] }),
      { status: 500 }
    );
  }
}
