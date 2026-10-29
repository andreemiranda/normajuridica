import React from 'react';
import Link from 'next/link';
import { Search, ArrowLeft, Home, Compass } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function NotFound() {
  const popularShortcuts = [
    { name: 'Todas as Notícias', href: '/' },
    { name: 'Justiça', href: '/categoria/justica' },
    { name: 'Política', href: '/categoria/politica' },
    { name: 'Economia', href: '/categoria/economia' },
    { name: 'Educação', href: '/categoria/educacao' },
    { name: 'Esporte', href: '/categoria/esporte' },
    { name: 'Saúde', href: '/categoria/saude' },
    { name: 'Tecnologia & Games', href: '/categoria/tecnologia-e-games' },
    { name: 'Pará', href: '/categoria/para' },
    { name: 'Tocantins', href: '/categoria/tocantins' },
    { name: 'Goiás', href: '/categoria/goias' },
    { name: 'Santa Catarina', href: '/categoria/santa-catarina' },
    { name: 'Mundo', href: '/categoria/mundo' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-16 flex flex-col items-center text-center justify-center">
        {/* Monogram Badge */}
        <div className="w-16 h-16 bg-brand-700 text-white rounded-3xl flex items-center justify-center font-black text-3xl shadow-xl mb-6 ring-4 ring-brand-100 dark:ring-brand-950">
          NJ
        </div>

        <span className="text-sm font-black uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-2">
          Erro 404 • Página Não Encontrada
        </span>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-zinc-50 tracking-tight mb-4">
          Conteúdo não localizado ou movido
        </h1>

        <p className="text-sm sm:text-base text-slate-600 dark:text-zinc-400 max-w-lg mb-8 leading-relaxed">
          O endereço que você tentou acessar não existe ou foi atualizado pela redação do Norma Jurídica.
        </p>

        {/* Search Input Box */}
        <div className="w-full max-w-md mb-10">
          <form action="/" method="GET" className="relative">
            <input
              type="search"
              name="q"
              placeholder="Pesquisar notícias no portal..."
              className="w-full px-4 py-3 pl-11 rounded-2xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-slate-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          </form>
        </div>

        {/* Shortcuts */}
        <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-4">
            <Compass className="w-4 h-4 text-brand-700" />
            <span>Navegue pelas Principais Editorias</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {popularShortcuts.map(sc => (
              <Link
                key={sc.href}
                href={sc.href}
                className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/60 dark:hover:text-brand-400 text-xs font-bold rounded-xl transition-colors"
              >
                {sc.name}
              </Link>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
            >
              <Home className="w-4 h-4" />
              <span>Ir para a Página Inicial</span>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
