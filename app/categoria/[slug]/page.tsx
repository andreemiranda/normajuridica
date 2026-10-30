import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchNews } from '@/lib/news-fetcher';
import { resolveCategoryDisplayName, normalizeCategoryText } from '@/lib/sources';
import { categorySlugify } from '@/lib/slug';
import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { NewsCard } from '@/components/NewsCard';
import { Footer } from '@/components/Footer';
import { SITE_CONFIG, getBaseUrl } from '@/lib/site-config';
import { AdSenseBanner } from '@/components/AdSenseBanner';

export const revalidate = 20; // ISR 20s


interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const cleanSlug = categorySlugify(decodedSlug);
  const categoryName = resolveCategoryDisplayName(cleanSlug);
  const baseUrl = getBaseUrl();

  return {
    title: `Notícias sobre ${categoryName}`,
    description: `Acompanhe as últimas notícias, análises e reportagens sobre ${categoryName} no portal ${SITE_CONFIG.name}.`,
    alternates: {
      canonical: `${baseUrl}/categoria/${cleanSlug}`,
    },
    openGraph: {
      title: `${categoryName} | ${SITE_CONFIG.name}`,
      description: `Cobertura especial de ${categoryName} no portal ${SITE_CONFIG.name}.`,
      url: `${baseUrl}/categoria/${cleanSlug}`,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const cleanSlug = categorySlugify(decodedSlug);

  // If the URL contains accented or non-canonical characters (e.g. justi%C3%A7a), redirect 308 to clean slug
  if (decodedSlug !== cleanSlug) {
    redirect(`/categoria/${cleanSlug}`);
  }

  const categoryName = resolveCategoryDisplayName(cleanSlug);
  const { items } = await fetchNews({ category: categoryName, limit: 30 });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-zinc-950">
      <Header />
      <CategoryTabs activeCategory={cleanSlug} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {/* Category Header */}
        <div className="mb-8 pb-4 border-b border-slate-200 dark:border-zinc-800">
          <span className="text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-1">
            Editoria
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
            {categoryName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
            Cobertura analítica e factual sobre {categoryName.toLowerCase()}, decisões oficiais e impactos para o cidadão.
          </p>
        </div>

        {/* Ad Banner */}
        <div className="mb-8">
          <AdSenseBanner slot={SITE_CONFIG.adsense.slots.header} />
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8">
            <h2 className="text-lg font-black text-slate-900 dark:text-zinc-100 mb-2">
              Nenhuma matéria recente em {categoryName}
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Nossa redação segue monitorando novas publicações oficiais desta editoria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(news => (
              <NewsCard key={news.slug} news={news} variant="grid" />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
