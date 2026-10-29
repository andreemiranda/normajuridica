import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, ArrowRight, ShieldCheck } from 'lucide-react';
import { INSTITUTIONAL_PAGES } from '@/lib/wp';
import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { Footer } from '@/components/Footer';
import { SITE_CONFIG, getBaseUrl } from '@/lib/site-config';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  return {
    title: 'Páginas Institucionais & Governança',
    description: `Índice de transparência, ouvidoria, compromissos éticos e governança do portal ${SITE_CONFIG.name}.`,
    alternates: {
      canonical: `${baseUrl}/pagina`,
    },
    openGraph: {
      title: `Páginas Institucionais | ${SITE_CONFIG.name}`,
      description: `Governança e transparência do ${SITE_CONFIG.name}.`,
      url: `${baseUrl}/pagina`,
    },
  };
}

export default function PaginaIndexPage() {
  const pages = Object.values(INSTITUTIONAL_PAGES);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-zinc-950">
      <Header />
      <CategoryTabs />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <div className="mb-10 pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-brand-700 dark:text-brand-400" />
            <span className="text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-400">
              Institucional
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
            Transparência, Ética & Governança
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
            Consulte nossos relatórios de prestação de contas, princípios editoriais e canais de relacionamento.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pages.map(p => (
            <Link
              key={p.slug}
              href={`/pagina/${p.slug}`}
              className="group p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-sm hover:shadow-xl hover:border-brand-300 dark:hover:border-brand-700 transition-all flex flex-col justify-between hover:-translate-y-0.5"
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-400 mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{p.category}</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors mb-2">
                  {p.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                  {p.lead}
                </p>
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800/80 text-xs font-bold text-brand-700 dark:text-brand-400 group-hover:translate-x-1 transition-transform">
                <span>Ler documento oficial</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
