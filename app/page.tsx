import React, { Suspense } from 'react';
import { fetchNews } from '@/lib/news-fetcher';
import { HomePageClient } from '@/components/HomePageClient';

export const revalidate = 30;

interface HomePageProps {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    page?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const sp = (await searchParams) || {};
  const initialQuery = (sp.q || '').trim();
  const initialCategory = (sp.category || 'all').trim() || 'all';
  const initialPage = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const limit = initialCategory === 'all' || initialCategory === 'todas' ? 24 : 12;

  let initialNews: Awaited<ReturnType<typeof fetchNews>>['items'] = [];
  let initialTotal = 0;

  try {
    const res = await fetchNews({
      category: initialCategory !== 'all' && initialCategory !== 'todas' ? initialCategory : undefined,
      searchQuery: initialQuery || undefined,
      page: initialPage,
      limit,
    });
    initialNews = res.items || [];
    initialTotal = res.total || 0;
  } catch {
    initialNews = [];
    initialTotal = 0;
  }

  const initialTotalPages = Math.max(1, Math.ceil(initialTotal / limit));

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-brand-700 rounded-2xl flex items-center justify-center text-white font-black text-2xl animate-pulse">
              NJ
            </div>
            <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">
              Carregando portal Norma Jurídica...
            </p>
          </div>
        </div>
      }
    >
      <HomePageClient
        initialNews={initialNews}
        initialTotal={initialTotal}
        initialTotalPages={initialTotalPages}
        initialCategory={initialCategory}
        initialQuery={initialQuery}
        initialPage={initialPage}
      />
    </Suspense>
  );
}
