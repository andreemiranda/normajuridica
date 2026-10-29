import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Cookie, ChevronRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { Footer } from '@/components/Footer';
import { SITE_CONFIG, getBaseUrl } from '@/lib/site-config';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  return {
    title: 'Política e Gestão de Cookies',
    description: `Saiba como utilizamos cookies e como gerenciar suas preferências no portal ${SITE_CONFIG.name}.`,
    alternates: {
      canonical: `${baseUrl}/cookies`,
    },
    openGraph: {
      title: `Política de Cookies | ${SITE_CONFIG.name}`,
      description: `Gestão de cookies e privacidade no ${SITE_CONFIG.name}.`,
      url: `${baseUrl}/cookies`,
    },
  };
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header />
      <CategoryTabs />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
        <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-6">
          <Link href="/" className="hover:text-brand-700 dark:hover:text-brand-400">Início</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-800 dark:text-zinc-200 font-medium">Política de Cookies</span>
        </nav>

        <div className="mb-8 pb-6 border-b border-slate-200 dark:border-zinc-800">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 rounded-full text-xs font-black uppercase tracking-wider mb-3">
            <Cookie className="w-3.5 h-3.5" />
            <span>Gestão de Privacidade</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-zinc-50 tracking-tight leading-tight mb-4">
            Política e Gestão de Cookies
          </h1>
          <p className="text-base text-slate-600 dark:text-zinc-300 leading-relaxed border-l-4 border-brand-700 pl-4">
            Entenda quais categorias de cookies operam no <strong>{SITE_CONFIG.name}</strong> e como controlar suas preferências a qualquer momento.
          </p>
        </div>

        <article className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-zinc-200 font-serif leading-8 text-base md:text-lg space-y-6">
          <h2>1. O que são Cookies?</h2>
          <p>
            Cookies são pequenos arquivos de texto armazenados no navegador do leitor para memorizar preferências de idioma, tema visual (modo claro/escuro), tamanho de fonte e matérias salvas.
          </p>

          <h2>2. Categorias de Cookies Utilizadas</h2>
          <ul>
            <li><strong>Cookies Essenciais:</strong> indispensáveis para o funcionamento técnico da plataforma, persistência de sessão e autenticação de segurança.</li>
            <li><strong>Cookies de Desempenho e Estatística:</strong> coletam dados anônimos de acesso para identificarmos reportagens de maior audiência e aprimorarmos a infraestrutura.</li>
            <li><strong>Cookies de Publicidade:</strong> viabilizam a exibição de anúncios pertinentes por meio do Google AdSense, auxiliando na sustentabilidade financeira do jornalismo independente.</li>
          </ul>

          <h2>3. Como Gerenciar Preferências</h2>
          <p>
            Você pode alterar suas configurações de cookies diretamente no seu navegador (Chrome, Firefox, Safari, Edge) ou aceitar apenas os cookies essenciais no banner disponibilizado em nosso portal.
          </p>
        </article>
      </main>

      <Footer />
    </div>
  );
}
