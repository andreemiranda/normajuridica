'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, MapPin, Phone, Mail, ShieldCheck } from 'lucide-react';
import { SITE_CONFIG } from '@/lib/site-config';
import { AdSenseBanner } from './AdSenseBanner';

export function Footer() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-16">
      {/* Footer Ad Banner */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <AdSenseBanner slot={SITE_CONFIG.adsense.slots.footer} />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand & Mission */}
          <div className="lg:col-span-4 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5 focus:outline-none">
              <div className="w-9 h-9 bg-brand-700 rounded-xl flex items-center justify-center text-white font-black text-xl tracking-tighter">
                NJ
              </div>
              <span className="text-xl font-black tracking-tight text-white">
                NORMA <span className="text-brand-400">JURÍDICA</span>
              </span>
            </Link>

            <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
              Cobertura jornalística independente, transparente e contínua sobre política, economia, justiça, educação, esportes, tecnologia e os estados brasileiros.
            </p>

            {/* Institutional Data Box */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 text-xs space-y-2 text-slate-300">
              <div className="flex items-center gap-2 font-semibold text-white">
                <ShieldCheck className="w-4 h-4 text-brand-400" />
                <span>Dados Institucionais Oficiais</span>
              </div>
              <div className="flex items-start gap-2 text-slate-400">
                <span className="text-slate-200 font-medium">Responsável:</span>
                <span>{SITE_CONFIG.institutional.responsible}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                <span>{SITE_CONFIG.institutional.address}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Phone className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                <span>{SITE_CONFIG.institutional.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Mail className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                <span suppressHydrationWarning>{SITE_CONFIG.institutional.email}</span>
              </div>
            </div>
          </div>

          {/* Editorias Column */}
          <div className="lg:col-span-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-white mb-4">
              Editorias Principais
            </h3>
            <ul className="space-y-2 text-xs md:text-sm">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Todas as Notícias
                </Link>
              </li>
              <li>
                <Link href="/categoria/politica" className="hover:text-white transition-colors">
                  Política
                </Link>
              </li>
              <li>
                <Link href="/categoria/economia" className="hover:text-white transition-colors">
                  Economia
                </Link>
              </li>
              <li>
                <Link href="/categoria/justica" className="hover:text-white transition-colors">
                  Justiça
                </Link>
              </li>
              <li>
                <Link href="/categoria/educacao" className="hover:text-white transition-colors">
                  Educação
                </Link>
              </li>
              <li>
                <Link href="/categoria/saude" className="hover:text-white transition-colors">
                  Saúde
                </Link>
              </li>
              <li>
                <Link href="/categoria/esporte" className="hover:text-white transition-colors">
                  Esporte
                </Link>
              </li>
              <li>
                <Link href="/categoria/tecnologia-e-games" className="hover:text-white transition-colors">
                  Tecnologia & Games
                </Link>
              </li>
              <li>
                <Link href="/categoria/para" className="hover:text-white transition-colors">
                  Pará
                </Link>
              </li>
              <li>
                <Link href="/categoria/tocantins" className="hover:text-white transition-colors">
                  Tocantins
                </Link>
              </li>
            </ul>
          </div>

          {/* Institucional Column */}
          <div className="lg:col-span-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-white mb-4">
              Institucional & Governança
            </h3>
            <ul className="space-y-2 text-xs md:text-sm">
              <li>
                <Link href="/pagina/sobre" className="hover:text-white transition-colors">
                  Sobre o Portal
                </Link>
              </li>
              <li>
                <Link href="/pagina/linha-editorial" className="hover:text-white transition-colors">
                  Linha Editorial e Ética
                </Link>
              </li>
              <li>
                <Link href="/pagina/transparencia" className="hover:text-white transition-colors">
                  Transparência
                </Link>
              </li>
              <li>
                <Link href="/pagina/ouvidoria" className="hover:text-white transition-colors">
                  Ouvidoria Geral
                </Link>
              </li>
              <li>
                <Link href="/pagina/cadastro-certo" className="hover:text-white transition-colors">
                  Cadastro Certo
                </Link>
              </li>
              <li>
                <Link href="/pagina/sobre-a-prefeitura" className="hover:text-white transition-colors">
                  Gestão Pública Municipal
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div className="lg:col-span-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-white mb-4">
              Legal & Contato
            </h3>
            <ul className="space-y-2 text-xs md:text-sm">
              <li>
                <Link href="/contato" className="hover:text-white transition-colors font-medium text-brand-400">
                  Fale com a Redação
                </Link>
              </li>
              <li>
                <Link href="/privacidade" className="hover:text-white transition-colors">
                  Privacidade
                </Link>
              </li>
              <li>
                <Link href="/termos" className="hover:text-white transition-colors">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-white transition-colors">
                  Política de Cookies
                </Link>
              </li>
              <li>
                <Link href="/sitemap.xml" className="hover:text-white transition-colors">
                  Mapa do Site (XML)
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} {SITE_CONFIG.name}. Todos os direitos reservados.
          </div>
          <div>
            Brasília - DF
          </div>
        </div>
      </div>

      {/* Floating Back to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 p-3 bg-brand-700 hover:bg-brand-800 text-white rounded-full shadow-2xl transition-all duration-300 hover:scale-110 focus:outline-none focus-visible:ring-4 ring-brand-500 cursor-pointer"
          title="Voltar ao topo da página"
          aria-label="Voltar ao topo da página"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </footer>
  );
}
