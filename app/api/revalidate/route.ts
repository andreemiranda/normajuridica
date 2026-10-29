import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { clearNewsCache } from '@/lib/news-fetcher';
import { sanitizePublicData } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleRevalidation(req);
}

export async function POST(req: NextRequest) {
  return handleRevalidation(req);
}

async function handleRevalidation(req: NextRequest) {
  const configuredSecret = process.env.REVALIDATE_SECRET;

  if (!configuredSecret) {
    return NextResponse.json(
      sanitizePublicData({ error: 'Serviço de revalidação não configurado com REVALIDATE_SECRET no servidor.' }),
      { status: 503 }
    );
  }

  const url = req.nextUrl;
  let secret = url.searchParams.get('secret');

  if (!secret && req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    secret = body.secret;
  }

  if (secret !== configuredSecret) {
    return NextResponse.json(
      sanitizePublicData({ error: 'Segredo de revalidação inválido.' }),
      { status: 401 }
    );
  }

  clearNewsCache();

  try {
    revalidateTag('news');
    revalidateTag('posts');
    revalidateTag('categories');
    revalidateTag('pages');
    revalidatePath('/', 'layout');

    return NextResponse.json(
      sanitizePublicData({
        revalidated: true,
        timestamp: new Date().toISOString(),
        message: 'Cache local e tags revalidadas com sucesso.',
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
