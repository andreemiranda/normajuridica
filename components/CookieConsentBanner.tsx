'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, Shield, Check, X } from 'lucide-react';
import { STORAGE_KEYS } from '@/lib/accessibility';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.cookieConsent);
      if (!stored) {
        const timer = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const saveConsent = (allAccepted: boolean) => {
    try {
      const consentData = {
        essential: true,
        analytics: allAccepted,
        advertising: allAccepted,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.cookieConsent, JSON.stringify(consentData));
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de Cookies e Privacidade"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 shadow-2xl transition-all animate-fadeIn"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 rounded-xl flex-shrink-0">
            <Cookie className="w-6 h-6" />
          </div>
          <div className="text-xs md:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
            <p className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5 mb-1">
              <Shield className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              Sua privacidade é prioridade no Norma Jurídica
            </p>
            <p>
              Utilizamos cookies e tecnologias similares para aprimorar sua experiência de navegação, oferecer conteúdos editoriais personalizados e veicular publicidade relevante, em estrita conformidade com a LGPD. Saiba mais em nossa{' '}
              <Link href="/cookies" className="text-brand-700 dark:text-brand-400 font-semibold underline">
                Política de Cookies
              </Link>{' '}
              e{' '}
              <Link href="/privacidade" className="text-brand-700 dark:text-brand-400 font-semibold underline">
                Privacidade
              </Link>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0 w-full md:w-auto">
          <button
            type="button"
            onClick={() => saveConsent(false)}
            className="flex-1 md:flex-initial px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Apenas essenciais</span>
          </button>

          <button
            type="button"
            onClick={() => saveConsent(true)}
            className="flex-1 md:flex-initial px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Aceitar todos</span>
          </button>
        </div>
      </div>
    </div>
  );
}
