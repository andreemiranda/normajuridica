import { NextRequest, NextResponse } from 'next/server';
import { getNewsItemBySlugOrId } from '@/lib/news-fetcher';
import { getNewsStore } from '@/lib/news-store';
import { resolveSourceNewsSlugsWithApi } from '@/lib/news-sync';
import { fetchFullArticleBody, ensureCompleteArticleText } from '@/lib/article-extractor';
import { sanitizePublicData } from '@/lib/security';
import { repairAndSanitizeArticleHtml, extractUnresolvedSourceNewsCandidates } from '@/lib/sanitizer';
import { SITE_CONFIG } from '@/lib/site-config';

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
    let featuredImage = '';

    // 1. Try finding in news cache / DB / upstream API (with embedded link resolution)
    if (slug) {
      const item = await getNewsItemBySlugOrId(slug, { resolveApiLinks: true });
      if (item) {
        if (item.imageUrl) featuredImage = item.imageUrl;
        if (item.contentHtml && item.contentHtml.length > 250) {
          contentHtml = item.contentHtml;
        }
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

    // 4. Sanitize and resolve links (APP_URL + DB + API check + target="_blank" for external/file links)
    const store = getNewsStore();
    await store.init();
    const unresolved = extractUnresolvedSourceNewsCandidates(contentHtml, {
      currentArticleSlug: slug,
      resolveSlugInDb: (c) => store.resolveSourceArticleSlug(c),
    });
    const apiResolved =
      unresolved.length > 0
        ? await resolveSourceNewsSlugsWithApi(unresolved, category)
        : new Map<string, string>();

    const rawAppUrl = (process.env.APP_URL || '').trim();
    const appUrl =
      rawAppUrl && !rawAppUrl.includes('MY_APP_URL')
        ? rawAppUrl.replace(/\/+$/, '')
        : '';

    const cleanHtml = repairAndSanitizeArticleHtml(
      contentHtml,
      featuredImage ? [featuredImage] : [],
      {
        appUrl,
        appDomain: SITE_CONFIG.domain,
        currentArticleSlug: slug,
        resolveSlugInDb: (candidate) =>
          store.resolveSourceArticleSlug(candidate) ?? apiResolved.get(candidate) ?? null,
        deferMissingLinkFallback: false,
      }
    );

    return NextResponse.json(
      sanitizePublicData({
        success: true,
        slug,
        contentHtml: cleanHtml,
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
