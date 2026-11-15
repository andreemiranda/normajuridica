import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { clearNewsCache } from '@/lib/news-fetcher';
import { sanitizePublicData, checkRateLimit, verifySecret, sanitizeInput, getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleRevalidation(req);
}

export async function POST(req: NextRequest) {
  return handleRevalidation(req);
}

async function handleRevalidation(req: NextRequest) {
  const clientIp = getClientIp(req.headers);
  const rateLimit = checkRateLimit(`revalidate:${clientIp}`, 20, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      sanitizePublicData({ error: 'Muitas requisições de revalidação. Tente novamente em instantes.' }),
      { status: 429, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  const configuredSecret = (process.env.REVALIDATE_SECRET || process.env.CRON_SECRET || '').trim();
  if (!configuredSecret) {
    return NextResponse.json(
      sanitizePublicData({ error: 'Segredo de revalidação não configurado no ambiente do servidor.' }),
      { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  const url = req.nextUrl;
  const authHeader = req.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  let secret = req.headers.get('x-revalidate-secret') || url.searchParams.get('secret') || bearer || null;
  let isAll = url.searchParams.get('all') === 'true' || url.searchParams.get('all') === '1';
  let slug = sanitizeInput(url.searchParams.get('slug'), 200);
  let path = sanitizeInput(url.searchParams.get('path'), 200);
  let tag = sanitizeInput(url.searchParams.get('tag'), 100);
  let postType = sanitizeInput(url.searchParams.get('type') || url.searchParams.get('post_type'), 50);

  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body === 'object') {
        if (!secret && typeof body.secret === 'string') secret = body.secret;
        if (body.all === true || body.all === 'true') isAll = true;
        if (!slug && typeof body.slug === 'string') slug = sanitizeInput(body.slug, 200);
        if (!path && typeof body.path === 'string') path = sanitizeInput(body.path, 200);
        if (!tag && typeof body.tag === 'string') tag = sanitizeInput(body.tag, 100);
        if (!postType && (body.type || body.post_type)) {
          postType = sanitizeInput(String(body.type || body.post_type), 50);
        }
        if (body.post && typeof body.post === 'object') {
          const wpPost = body.post as Record<string, unknown>;
          if (!slug && wpPost.post_name) slug = sanitizeInput(String(wpPost.post_name), 200);
          if (!postType && wpPost.post_type) postType = sanitizeInput(String(wpPost.post_type), 50);
        }
      }
    } catch {}
  }

  const isAuthorized = verifySecret(secret, configuredSecret);

  if (!isAuthorized) {
    return NextResponse.json(
      sanitizePublicData({ error: 'Segredo de revalidação inválido.' }),
      { status: 401, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  if (path && (path.includes('..') || path.includes('//'))) {
    return NextResponse.json(
      sanitizePublicData({ error: 'Caminho de revalidação inválido.' }),
      { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  clearNewsCache();

  try {
    if (isAll || (!slug && !path && !tag)) {
      revalidateTag('news');
      revalidateTag('posts');
      revalidateTag('categories');
      revalidateTag('pages');
      revalidatePath('/', 'layout');
    } else {
      if (slug) {
        const cleanSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '');
        if (cleanSlug) {
          revalidatePath(`/noticia/${cleanSlug}`);
          revalidatePath('/');
          revalidateTag('news');
          revalidateTag('posts');
        }
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
      }),
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch {
    return NextResponse.json(
      sanitizePublicData({ error: 'Falha interna ao revalidar cache.' }),
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
