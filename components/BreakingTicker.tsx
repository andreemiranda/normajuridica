'use client';

import React from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { NewsItem } from '@/lib/types';

interface BreakingTickerProps {
  news: NewsItem[];
}

export function BreakingTicker({ news }: BreakingTickerProps) {
  if (!news || news.length === 0) return null;

  // Use top 10 news items
  const tickerItems = news.slice(0, 10);
  // Duplicate for seamless infinite marquee loop
  const duplicated = [...tickerItems, ...tickerItems];

  return (
    <div
      className="bg-brand-950 text-white border-b border-brand-900/60 overflow-hidden py-2"
      aria-label="Notícias de Última Hora"
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-3">
        {/* Pulsing badge */}
        <div className="flex-shrink-0 flex items-center gap-1.5 bg-brand-800 text-amber-300 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider shadow-inner">
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
          <span>Última Hora</span>
        </div>

        {/* Marquee stream */}
        <div className="overflow-hidden relative w-full mask-linear">
          <div className="animate-marquee whitespace-nowrap flex items-center gap-8 py-0.5">
            {duplicated.map((item, index) => (
              <Link
                key={`${item.slug}-${index}`}
                href={`/noticia/${item.slug}`}
                prefetch={true}
                className="inline-flex items-center gap-2 text-xs md:text-sm text-slate-200 hover:text-white group transition-colors"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-300 bg-brand-900/80 px-1.5 py-0.5 rounded">
                  {item.category}
                </span>
                <span className="group-hover:underline font-medium text-slate-100 max-w-[320px] md:max-w-[450px] truncate">
                  {item.title}
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  ({item.timeAgo})
                </span>
                <span className="text-slate-600 font-bold ml-4" aria-hidden="true">
                  •
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
