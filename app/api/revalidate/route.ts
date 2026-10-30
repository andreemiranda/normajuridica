import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { clearNewsCache } from '@/lib/news-fetcher';
import { sanitizePublicData } from '@/lib/security';

export const dynamic = 'force-dynamic';

const DEFAULT_SECRET = 'camara-paraiso-revalidate-secret-token';

export async function GET(req: NextRequest) {
  return handleRevalidation(req);
}

export async function POST(req: NextRequest) {
  return handleRevalidation(req);
}

async function handleRevalidation(req: NextRequest) {
  const configuredSecret = process.env.REVALIDATE_SECRET || DEFAULT_SECRET;

  const url = req.nextUrl;
  let secret = url.searchParams.get('secret');
  let isAll = url.searchParams.get('all') === 'true' || url.searchParams.get('all') === '1';
  let slug = url.searchParams.get('slug') || '';
  let path = url.searchParams.get('path') || '';
  let tag = url.searchParams.get('tag') || '';
  let postType = url.searchParams.get('type') || url.searchParams.get('post_type') || '';

  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      if (body) {
        if (!secret && body.secret) secret = String(body.secret);
        if (body.all === true || body.all === 'true') isAll = true;
        if (!slug && body.slug) slug = String(body.slug);
        if (!path && body.path) path = String(body.path);
        if (!tag && body.tag) tag = String(body.tag);
        if (!postType && (body.type || body.post_type)) {
          postType = String(body.type || body.post_type);
        }
        // WP Webhooks format: body.post.post_name or body.post.post_type
        if (body.post && typeof body.post === 'object') {
          const wpPost = body.post as Record<string, unknown>;
          if (!slug && wpPost.post_name) slug = String(wpPost.post_name);
          if (!postType && wpPost.post_type) postType = String(wpPost.post_type);
        }
      }
    } catch {}
  }

  // Validate Secret: must match configuredSecret or DEFAULT_SECRET
  const isAuthorized =
    secret === configuredSecret ||
    secret === DEFAULT_SECRET ||
    (process.env.REVALIDATE_SECRET && secret === process.env.REVALIDATE_SECRET);

  if (!isAuthorized) {
    return NextResponse.json(
      sanitizePublicData({ error: 'Segredo de revalidação inválido.' }),
      { status: 401 }
    );
  }

  // Clear in-memory news cache
  clearNewsCache();

  try {
    // 1. General revalidation (all=true, or no specific slug/path given)
    if (isAll || (!slug && !path && !tag)) {
      revalidateTag('news');
      revalidateTag('posts');
      revalidateTag('categories');
      revalidateTag('pages');
      revalidatePath('/', 'layout');
    } else {
      // 2. Targeted revalidation
      if (slug) {
        revalidatePath(`/noticia/${slug}`);
        revalidatePath('/');
        revalidateTag('news');
        revalidateTag('posts');
      }
      if (path) {
        revalidatePath(path.startsWith('/') ? path : `/${path}`);
        revalidatePath('/');
      }
      if (tag) {
        revalidateTag(tag);
      }
    }

    return NextResponse.json(
      sanitizePublicData({
        revalidated: true,
        timestamp: new Date().toISOString(),
        action: isAll ? 'all' : 'targeted',
        postType: postType || 'post',
        target: slug || path || tag || 'all',
        message: 'Cache e tags revalidadas com sucesso.',
      })
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Falha na revalidação';
    return NextResponse.json(
      sanitizePublicData({ error: errorMsg }),
      { status: 500 }
    );
  }
}

