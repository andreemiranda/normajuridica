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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const result = await fetchNews({
      category,
      sourceId,
      searchQuery: q,
      page,
      limit,
      refresh,
    });

    const response = {
      items: result.items,
      source: 'upstream',
      total: result.total,
      isRealTime: result.isRealTime,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(sanitizePublicData(response), {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro ao processar notícias';
    return NextResponse.json(
      sanitizePublicData({ error: errorMsg, items: [] }),
      { status: 500 }
    );
  }
}
