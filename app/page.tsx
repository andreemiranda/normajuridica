import React, { Suspense } from 'react';
import { HomePageClient } from '@/components/HomePageClient';

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-brand-700 rounded-2xl flex items-center justify-center text-white font-black text-2xl animate-pulse">
              NJ
            </div>
            <p className="text-sm font-bold text-slate-600 dark:text-zinc-400">
              Carregando portal Norma Jurídica...
            </p>
          </div>
        </div>
      }
    >
      <HomePageClient />
    </Suspense>
  );
}
