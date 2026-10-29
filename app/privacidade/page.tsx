import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, ChevronRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { Footer } from '@/components/Footer';
import { SITE_CONFIG, getBaseUrl } from '@/lib/site-config';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  return {
    title: 'Política de Privacidade e Proteção de Dados (LGPD)',
    description: `Diretrizes de privacidade, segurança da informação e tratamento de dados pessoais do portal ${SITE_CONFIG.name}.`,
    alternates: {
      canonical: `${baseUrl}/privacidade`,
    },
    openGraph: {
      title: `Privacidade e LGPD | ${SITE_CONFIG.name}`,
      description: `Proteção de dados no ${SITE_CONFIG.name}.`,
      url: `${baseUrl}/privacidade`,
    },
  };
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header />
      <CategoryTabs />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
        <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-6">
          <Link href="/" className="hover:text-brand-700 dark:hover:text-brand-400">Início</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-800 dark:text-zinc-200 font-medium">Política de Privacidade</span>
        </nav>

        <div className="mb-8 pb-6 border-b border-slate-200 dark:border-zinc-800">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 rounded-full text-xs font-black uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Conformidade Legal (Lei nº 13.709/2018)</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-zinc-50 tracking-tight leading-tight mb-4">
            Política de Privacidade e Proteção de Dados
          </h1>
          <p className="text-base text-slate-600 dark:text-zinc-300 leading-relaxed border-l-4 border-brand-700 pl-4">
            O <strong>{SITE_CONFIG.name}</strong> preza pela máxima confidencialidade e segurança dos dados de seus leitores, colaboradores e fontes.
          </p>
        </div>

        <article className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-zinc-200 font-serif leading-8 text-base md:text-lg space-y-6">
          <h2>1. Introdução e Abrangência</h2>
          <p>
            Esta Política de Privacidade descreve as práticas adotadas pelo <strong>{SITE_CONFIG.name}</strong>, com sede em <strong>{SITE_CONFIG.institutional.address}</strong>, para coleta, armazenamento, processamento e proteção de informações dos usuários que acessam nossos serviços digitais.
          </p>

          <h2>2. Coleta de Informações</h2>
          <p>
            Coletamos apenas dados estritamente necessários para a prestação de serviços informativos, que incluem:
          </p>
          <ul>
            <li><strong>Dados de navegação e técnicos:</strong> endereço IP, tipo de navegador, sistema operacional e páginas visualizadas para fins de diagnóstico e segurança da infraestrutura.</li>
            <li><strong>Dados fornecidos voluntariamente:</strong> nome e e-mail quando o leitor entra em contato através de nossa Central de Atendimento ou assina informativos.</li>
          </ul>

          <h2>3. Finalidade do Tratamento</h2>
          <p>
            Os dados coletados são empregados para:
          </p>
          <ul>
            <li>Garantir a estabilidade e segurança das aplicações;</li>
            <li>Responder tempestivamente a demandas protocoladas via Ouvidoria e Redação;</li>
            <li>Apresentar métricas estatísticas anônimas de audiência;</li>
            <li>Exibir anúncios relevantes sem comercialização de dados pessoais a terceiros.</li>
          </ul>

          <h2>4. Direitos dos Titulares de Dados</h2>
          <p>
            Em cumprimento à LGPD, o titular de dados possui o direito de confirmar a existência de tratamento, acessar seus dados, solicitar a correção de dados incompletos ou requerer a eliminação de dados tratados com seu consentimento, mediante solicitação formal via <Link href="/contato" className="text-brand-700 font-semibold underline">Canal de Atendimento</Link>.
          </p>

          <h2>5. Encarregado pelo Tratamento de Dados (DPO)</h2>
          <p>
            Para exercer seus direitos ou esclarecer dúvidas sobre esta política, o usuário poderá contatar diretamente nosso responsável institucional pelo e-mail <strong>{SITE_CONFIG.institutional.email}</strong> ou pelo telefone <strong>{SITE_CONFIG.institutional.phone}</strong>.
          </p>
        </article>
      </main>

      <Footer />
    </div>
  );
}
