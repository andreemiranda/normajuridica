import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchNews } from '@/lib/news-fetcher';
import { resolveCategoryDisplayName } from '@/lib/sources';
import { categorySlugify } from '@/lib/slug';
import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { NewsCard } from '@/components/NewsCard';
import { Pagination } from '@/components/Pagination';
import { Footer } from '@/components/Footer';
import { SITE_CONFIG, getBaseUrl } from '@/lib/site-config';
import { AdSenseBanner } from '@/components/AdSenseBanner';

export const revalidate = 20; // ISR 20s

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string }>;
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const rawPage = resolvedSearchParams.page;
  const page = Math.max(1, parseInt(typeof rawPage === 'string' ? rawPage : '1', 10) || 1);

  const decodedSlug = decodeURIComponent(slug);
  const cleanSlug = categorySlugify(decodedSlug);
  const categoryName = resolveCategoryDisplayName(cleanSlug);
  const baseUrl = getBaseUrl();
  const pageSuffix = page > 1 ? ` - Página ${page}` : '';

  return {
    title: `Notícias sobre ${categoryName}${pageSuffix}`,
    description: `Acompanhe as últimas notícias, análises e reportagens sobre ${categoryName} no portal ${SITE_CONFIG.name}.${pageSuffix}`,
    alternates: {
      canonical: page > 1 ? `${baseUrl}/categoria/${cleanSlug}?page=${page}` : `${baseUrl}/categoria/${cleanSlug}`,
    },
    openGraph: {
      title: `${categoryName}${pageSuffix} | ${SITE_CONFIG.name}`,
      description: `Cobertura especial de ${categoryName} no portal ${SITE_CONFIG.name}.${pageSuffix}`,
      url: page > 1 ? `${baseUrl}/categoria/${cleanSlug}?page=${page}` : `${baseUrl}/categoria/${cleanSlug}`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const rawPage = resolvedSearchParams.page;
  const page = Math.max(1, parseInt(typeof rawPage === 'string' ? rawPage : '1', 10) || 1);

  const decodedSlug = decodeURIComponent(slug);
  const cleanSlug = categorySlugify(decodedSlug);

  // Redirect legacy noticias-gerais to brasil
  if (cleanSlug === 'noticias-gerais') {
    redirect('/categoria/brasil');
  }

  // If the URL contains accented or non-canonical characters (e.g. justi%C3%A7a), redirect 308 to clean slug
  if (decodedSlug !== cleanSlug) {
    redirect(`/categoria/${cleanSlug}`);
  }

  const categoryName = resolveCategoryDisplayName(cleanSlug);
  const limit = 12;
  const { items, total } = await fetchNews({ category: cleanSlug, page, limit });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-zinc-950">
      <Header />
      <CategoryTabs activeCategory={cleanSlug} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {/* Category Header */}
        <div className="mb-8 pb-4 border-b border-slate-200 dark:border-zinc-800">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
            {categoryName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
            Cobertura analítica e factual sobre {categoryName.toLowerCase()}, decisões oficiais e acontecimentos em tempo real.
          </p>
        </div>

        {/* Ad Banner */}
        <div className="mb-8">
          <AdSenseBanner slot={SITE_CONFIG.adsense.slots.header} />
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8">
            <h2 className="text-lg font-black text-slate-900 dark:text-zinc-100 mb-2">
              Edição em apuração • {categoryName}
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              A redação do Norma Jurídica está processando e checando novas matérias oficiais para esta editoria em tempo real.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map(news => (
                <NewsCard key={news.slug} news={news} variant="grid" />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  baseUrl={`/categoria/${cleanSlug}`}
                  currentPage={page}
                  totalPages={totalPages}
                />
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
