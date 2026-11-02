import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, ChevronRight } from 'lucide-react';
import { INSTITUTIONAL_PAGES, getGenericPage } from '@/lib/wp';
import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { Footer } from '@/components/Footer';
import { SITE_CONFIG, getBaseUrl } from '@/lib/site-config';

interface PaginaViewProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PaginaViewProps): Promise<Metadata> {
  const { slug } = await params;
  const page = INSTITUTIONAL_PAGES[slug] || getGenericPage(slug);
  const baseUrl = getBaseUrl();

  return {
    title: `${page.title} | ${SITE_CONFIG.name}`,
    description: page.lead,
    alternates: {
      canonical: `${baseUrl}/pagina/${slug}`,
    },
    openGraph: {
      title: `${page.title} | ${SITE_CONFIG.name}`,
      description: page.lead,
      url: `${baseUrl}/pagina/${slug}`,
    },
  };
}

export default async function PaginaViewPage({ params }: PaginaViewProps) {
  const { slug } = await params;
  const page = INSTITUTIONAL_PAGES[slug] || getGenericPage(slug);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header />
      <CategoryTabs />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
        {/* Breadcrumbs */}
        <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-6">
          <Link href="/" className="hover:text-brand-700 dark:hover:text-brand-400 transition-colors">
            Início
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link href="/pagina" className="hover:text-brand-700 dark:hover:text-brand-400 transition-colors">
            Institucional
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-800 dark:text-zinc-200 font-medium">
            {page.title}
          </span>
        </nav>

        {/* Page Header */}
        <div className="mb-8 pb-6 border-b border-slate-200 dark:border-zinc-800">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 rounded-full text-xs font-black uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{page.category}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-zinc-50 tracking-tight leading-tight mb-4">
            {page.title}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-zinc-300 leading-relaxed border-l-4 border-brand-700 pl-4 text-justify hyphens-none">
            {page.lead}
          </p>
        </div>

        {/* Page Body with Justified text */}
        <article
          className="article-body prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-zinc-200 font-serif leading-8 text-base md:text-lg mb-12 text-justify hyphens-none [text-align:justify]"
          dangerouslySetInnerHTML={{ __html: page.contentHtml }}
        />

        <div className="pt-6 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center">
          <Link
            href="/pagina"
            className="inline-flex items-center gap-2 text-xs font-bold text-brand-700 dark:text-brand-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao índice institucional</span>
          </Link>

          <Link
            href="/contato"
            className="px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            Fale com a Redação
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
