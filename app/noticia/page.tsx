import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchNews } from '@/lib/news-fetcher';
import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { NewsCard } from '@/components/NewsCard';
import { Footer } from '@/components/Footer';
import { SITE_CONFIG, getBaseUrl } from '@/lib/site-config';

export const revalidate = 20; // ISR 20s


export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  return {
    title: 'Últimas Notícias e Sala de Imprensa',
    description: `Acompanhe em tempo real todas as últimas notícias, coberturas de tribunais, política e economia no portal ${SITE_CONFIG.name}.`,
    alternates: {
      canonical: `${baseUrl}/noticia`,
    },
    openGraph: {
      title: `Últimas Notícias | ${SITE_CONFIG.name}`,
      description: `Cobertura editorial contínua no ${SITE_CONFIG.name}.`,
      url: `${baseUrl}/noticia`,
    },
  };
}

export default async function NoticiaIndexPage() {
  const { items } = await fetchNews({ category: 'all', limit: 30 });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-zinc-950">
      <Header />
      <CategoryTabs />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <div className="mb-8 pb-4 border-b border-slate-200 dark:border-zinc-800">
          <span className="text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-1">
            Sala de Imprensa
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
            Últimas Notícias do Brasil
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
            Feed consolidado de notícias apuradas e atualizadas minuto a minuto pela redação do Norma Jurídica.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(news => (
            <NewsCard key={news.slug} news={news} variant="grid" />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
