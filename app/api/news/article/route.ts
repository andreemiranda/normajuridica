import { NextRequest, NextResponse } from 'next/server';
import { getNewsItemBySlugOrId } from '@/lib/news-fetcher';
import { fetchFullArticleBody, ensureCompleteArticleText } from '@/lib/article-extractor';
import { sanitizePublicData } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const slug = searchParams.get('slug') || searchParams.get('id') || '';
    const url = searchParams.get('url') || searchParams.get('link') || '';
    const title = searchParams.get('title') || '';
    const category = searchParams.get('category') || 'Notícias';
    const text = searchParams.get('text') || '';

    let contentHtml = '';

    // 1. Try finding in news cache
    if (slug) {
      const item = await getNewsItemBySlugOrId(slug);
      if (item && item.contentHtml && item.contentHtml.length > 250) {
        contentHtml = item.contentHtml;
      }
    }

    // 2. If url provided and contentHtml still empty/short, fetch full body
    if (!contentHtml && url && url.startsWith('http')) {
      const fetched = await fetchFullArticleBody(url, 4500);
      if (fetched && fetched.length > 250) {
        contentHtml = fetched;
      }
    }

    // 3. Fallback or enrich with provided text or title
    if (!contentHtml || contentHtml.length < 300) {
      contentHtml = ensureCompleteArticleText(text || contentHtml, title, category);
    }

    return NextResponse.json(
      sanitizePublicData({
        success: true,
        slug,
        contentHtml,
      }),
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Falha ao recuperar artigo';
    return NextResponse.json(
      sanitizePublicData({
        success: true,
        contentHtml: '<p>O conteúdo completo desta reportagem está em atualização pela redação do Norma Jurídica.</p>',
        error: errorMsg,
      })
    );
  }
}
