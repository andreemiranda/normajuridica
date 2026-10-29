import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, ChevronRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { Footer } from '@/components/Footer';
import { SITE_CONFIG, getBaseUrl } from '@/lib/site-config';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  return {
    title: 'Termos e Condições de Uso',
    description: `Termos gerais de uso, direitos autorais e condições de navegação no portal ${SITE_CONFIG.name}.`,
    alternates: {
      canonical: `${baseUrl}/termos`,
    },
    openGraph: {
      title: `Termos de Uso | ${SITE_CONFIG.name}`,
      description: `Condições de uso do ${SITE_CONFIG.name}.`,
      url: `${baseUrl}/termos`,
    },
  };
}

export default function TermosPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      <Header />
      <CategoryTabs />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
        <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-6">
          <Link href="/" className="hover:text-brand-700 dark:hover:text-brand-400">Início</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-800 dark:text-zinc-200 font-medium">Termos de Uso</span>
        </nav>

        <div className="mb-8 pb-6 border-b border-slate-200 dark:border-zinc-800">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 rounded-full text-xs font-black uppercase tracking-wider mb-3">
            <FileText className="w-3.5 h-3.5" />
            <span>Condições Gerais</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-zinc-50 tracking-tight leading-tight mb-4">
            Termos e Condições Gerais de Uso
          </h1>
          <p className="text-base text-slate-600 dark:text-zinc-300 leading-relaxed border-l-4 border-brand-700 pl-4">
            Regras de utilização, propriedade intelectual e responsabilidades aplicáveis ao portal <strong>{SITE_CONFIG.name}</strong>.
          </p>
        </div>

        <article className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-zinc-200 font-serif leading-8 text-base md:text-lg space-y-6">
          <h2>1. Aceitação dos Termos</h2>
          <p>
            Ao acessar e utilizar os serviços do <strong>{SITE_CONFIG.name}</strong>, o usuário declara ter lido, compreendido e aceito integralmente as cláusulas presentes nestes Termos de Uso.
          </p>

          <h2>2. Propriedade Intelectual e Direitos Autorais</h2>
          <p>
            Todo o conteúdo textual, fotográfico, gráfico, logotipos e marcas do portal são de titularidade do <strong>{SITE_CONFIG.name}</strong> ou devidamente licenciados de terceiros, protegidos pela Lei de Direitos Autorais (Lei nº 9.610/1998). É vedada a reprodução comercial sem expressa autorização prévia por escrito.
          </p>

          <h2>3. Conduta do Usuário</h2>
          <p>
            O leitor compromete-se a utilizar o portal de forma ética e legítima, abstendo-se de transmitir vírus, realizar raspagens abusivas que comprometam os servidores, ou praticar ofensas e injúrias através de formulários de contato.
          </p>

          <h2>4. Foro e Legislação Aplicável</h2>
          <p>
            Estes termos são regidos pelas leis da República Federativa do Brasil, elegendo-se o foro da comarca de <strong>Brasília-DF</strong> para dirimir eventuais controvérsias decorrentes da interpretação deste documento.
          </p>
        </article>
      </main>

      <Footer />
    </div>
  );
}
