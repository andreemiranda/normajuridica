import { NextRequest, NextResponse } from 'next/server';
import { getNewsItemBySlugOrId } from '@/lib/news-fetcher';
import { getNewsStore } from '@/lib/news-store';
import { resolveSourceNewsSlugsWithApi } from '@/lib/news-sync';
import { fetchFullArticleBody, ensureCompleteArticleText, formatArticleParagraphsHtml } from '@/lib/article-extractor';
import { sanitizePublicData, checkRateLimit, assertSafeExternalUrl, sanitizeInput, getClientIp } from '@/lib/security';
import { repairAndSanitizeArticleHtml, extractUnresolvedSourceNewsCandidates, stripHtmlTags } from '@/lib/sanitizer';
import { SITE_CONFIG } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rateLimit = checkRateLimit(`article:${clientIp}`, 60, 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        sanitizePublicData({ error: 'Muitas requisições ao serviço de leitura. Tente novamente em instantes.' }),
        { status: 429, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const slug = sanitizeInput(searchParams.get('slug') || searchParams.get('id'), 220);
    const rawUrl = searchParams.get('url') || searchParams.get('link') || '';
    const safeExternalUrl = assertSafeExternalUrl(rawUrl);
    const title = sanitizeInput(searchParams.get('title'), 300);
    const category = sanitizeInput(searchParams.get('category'), 80) || 'Notícias';
    const text = (searchParams.get('text') || '').slice(0, 16000);

    let contentHtml = '';
    let featuredImage = '';
    let fallbackExternalUrl = safeExternalUrl ? safeExternalUrl.toString() : '';

    // 1. Try finding in news cache / DB / upstream API (with embedded link resolution)
    if (slug) {
      const item = await getNewsItemBySlugOrId(slug, { resolveApiLinks: true });
      if (item) {
        if (item.imageUrl) featuredImage = item.imageUrl;
        if (!fallbackExternalUrl && item.sourceUrl) {
          fallbackExternalUrl = item.sourceUrl;
        }
        if (item.contentHtml) {
          contentHtml = formatArticleParagraphsHtml(item.contentHtml);
        }
      }
    }

    // 2. If safe external url available and contentHtml still short/single-paragraph, fetch full body (SSRF protected)
    const plainLen = stripHtmlTags(contentHtml).length;
    const pCount = (contentHtml.match(/<p\b/gi) || []).length;
    if ((plainLen < 450 || pCount <= 1) && fallbackExternalUrl) {
      const fetched = await fetchFullArticleBody(fallbackExternalUrl, 50000);
      if (fetched && stripHtmlTags(fetched).length > plainLen + 80) {
        contentHtml = fetched;
      }
    }

    // 3. Format and enrich if empty or very brief
    contentHtml = ensureCompleteArticleText(contentHtml || text, title, category);

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
  } catch {
    return NextResponse.json(
      sanitizePublicData({
        success: true,
        contentHtml: '<p>O conteúdo completo desta reportagem está em atualização pela redação do Norma Jurídica.</p>',
      }),
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
