import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Layers, ArrowRight, MapPin, Newspaper } from 'lucide-react';
import { ALL_CATEGORIES } from '@/lib/sources';
import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { Footer } from '@/components/Footer';
import { SITE_CONFIG, getBaseUrl } from '@/lib/site-config';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  return {
    title: 'Guia Editorial & Todas as Editorias',
    description: `Catálogo completo de editorias temáticas e coberturas regionais do portal ${SITE_CONFIG.name}.`,
    alternates: {
      canonical: `${baseUrl}/categoria`,
    },
    openGraph: {
      title: `Guia de Editorias | ${SITE_CONFIG.name}`,
      description: `Todas as 54 seções editoriais do ${SITE_CONFIG.name}.`,
      url: `${baseUrl}/categoria`,
    },
  };
}

export default function CategoriasIndexPage() {
  const temas = ALL_CATEGORIES.filter(c => c.group === 'tema' && c.id !== 'all');
  const regioes = ALL_CATEGORIES.filter(c => c.group === 'regiao');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-zinc-950">
      <Header />
      <CategoryTabs />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <div className="mb-10 pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-brand-700 dark:text-brand-400" />
            <span className="text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-400">
              Guia Editorial Completo
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
            Editorias & Coberturas Regionais
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
            Navegue pelas 54 editorias temáticas e estaduais acompanhadas permanentemente pela equipe do Norma Jurídica.
          </p>
        </div>

        {/* Editorias Temáticas */}
        <section className="mb-12" aria-label="Editorias Temáticas">
          <div className="flex items-center gap-2 mb-6">
            <Newspaper className="w-4 h-4 text-brand-700" />
            <h2 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">
              Grandes Temas Nacionais
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {temas.map(cat => (
              <Link
                key={cat.slug}
                href={`/categoria/${cat.slug}`}
                className="group p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400">Editoria</span>
                    {cat.highlight && (
                      <span className="bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                        Destaque
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                    {cat.name}
                  </h3>
                </div>

                <div className="flex items-center justify-between mt-4 text-xs font-semibold text-brand-700 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Acessar matérias</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Estados e Regiões */}
        <section aria-label="Estados e Regiões">
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="w-4 h-4 text-brand-700" />
            <h2 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight">
              Estados, Capitais & Regiões
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {regioes.map(cat => (
              <Link
                key={cat.slug}
                href={`/categoria/${cat.slug}`}
                className="group p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400">Regional</span>
                    {cat.highlight && (
                      <span className="bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                        Destaque
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                    {cat.name}
                  </h3>
                </div>

                <div className="flex items-center justify-between mt-4 text-xs font-semibold text-brand-700 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Ver cobertura local</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
