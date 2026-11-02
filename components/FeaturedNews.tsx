'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { NewsItem } from '@/lib/types';
import { OptimizedImage } from './OptimizedImage';

interface FeaturedNewsProps {
  news: NewsItem[];
}

const SLIDE_DURATION_MS = 6000; // 6 seconds auto-transition as specified

export function FeaturedNews({ news }: FeaturedNewsProps) {
  // Take up to 10 news items covering distinct categories
  const slides = news.slice(0, 10);
  const totalSlides = slides.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const goToNext = useCallback(() => {
    if (totalSlides === 0) return;
    setCurrentIndex(prev => (prev + 1) % totalSlides);
    setProgress(0);
  }, [totalSlides]);

  const goToPrev = useCallback(() => {
    if (totalSlides === 0) return;
    setCurrentIndex(prev => (prev - 1 + totalSlides) % totalSlides);
    setProgress(0);
  }, [totalSlides]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setProgress(0);
  };

  // Auto transition every 6 seconds with smooth progress bar
  useEffect(() => {
    if (totalSlides <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    const stepMs = 50;
    const progressIncrement = (stepMs / SLIDE_DURATION_MS) * 100;

    progressIntervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          goToNext();
          return 0;
        }
        return p + progressIncrement;
      });
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [totalSlides, isPaused, goToNext, currentIndex]);

  if (totalSlides === 0) return null;

  const currentArticle = slides[currentIndex];

  return (
    <section
      className="mb-10"
      aria-label="Destaques Principais"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Slider Header Control Bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-6 bg-brand-700 dark:bg-brand-500 rounded-full" />
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
            <span>Destaques</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-600" />
            </span>
          </h2>
        </div>

        {/* Counter & Navigation Controls */}
        <div className="flex items-center gap-2">
          {/* Slide Indicator Badge */}
          <div className="px-3 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-full text-xs font-black text-slate-700 dark:text-zinc-300 shadow-sm flex items-center gap-1">
            <span className="text-brand-700 dark:text-brand-400">
              {String(currentIndex + 1).padStart(2, '0')}
            </span>
            <span className="text-slate-400">/</span>
            <span>{String(totalSlides).padStart(2, '0')}</span>
          </div>

          {/* Pause / Play button */}
          <button
            type="button"
            onClick={() => setIsPaused(p => !p)}
            className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-brand-500 text-slate-700 dark:text-zinc-300 hover:text-brand-700 dark:hover:text-brand-400 rounded-full text-xs transition-all duration-200 cursor-pointer shadow-sm hover:scale-105"
            title={isPaused ? 'Continuar' : 'Pausar'}
            aria-label={isPaused ? 'Continuar' : 'Pausar'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          {/* Prev Slide button */}
          <button
            type="button"
            onClick={goToPrev}
            className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-brand-500 text-slate-700 dark:text-zinc-300 hover:text-brand-700 dark:hover:text-brand-400 rounded-full text-xs transition-all duration-200 cursor-pointer shadow-sm hover:scale-105"
            title="Destaque anterior"
            aria-label="Voltar notícia em destaque"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Next Slide button */}
          <button
            type="button"
            onClick={goToNext}
            className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-brand-500 text-slate-700 dark:text-zinc-300 hover:text-brand-700 dark:hover:text-brand-400 rounded-full text-xs transition-all duration-200 cursor-pointer shadow-sm hover:scale-105"
            title="Próximo destaque"
            aria-label="Avançar notícia em destaque"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Slide Card */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-zinc-800 shadow-xl group" suppressHydrationWarning>
        <div
          className="relative aspect-[16/10] sm:aspect-[16/8] lg:aspect-[21/9] w-full overflow-hidden zoom-frame"
          suppressHydrationWarning
          data-pin-nopin="true"
          data-pin-no-hover="true"
        >
          <OptimizedImage
            key={currentArticle.slug}
            src={currentArticle.imageUrl}
            alt={currentArticle.title}
            fill
            priority={true}
            sizes="(max-width: 1024px) 100vw, 1200px"
            className="object-cover group-hover:scale-105 hover:scale-105 transition-transform duration-700 ease-out"
          />

          {/* Sophisticated dark gradient for high editorial contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-transparent hidden md:block" />

          {/* Category badge */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2 flex-wrap z-10">
            <span className="text-xs font-black uppercase tracking-wider text-white bg-brand-700 px-3.5 py-1.5 rounded-full shadow-md">
              {currentArticle.category}
            </span>
          </div>

          {/* Content Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 md:p-10 text-white flex flex-col justify-end z-10">
            {/* Meta info */}
            <div className="flex items-center gap-4 text-xs text-slate-300 font-medium mb-3">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-400" />
                {currentArticle.author || 'Norma Jurídica'}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-400" />
                {currentArticle.timeAgo}
              </span>
            </div>

            {/* Headline with link hover movement and color */}
            <Link
              href={`/noticia/${currentArticle.slug}`}
              prefetch={true}
              className="block group/link focus:outline-none mb-3"
            >
              <h3 className="text-xl sm:text-3xl md:text-4xl lg:text-4xl font-black tracking-tight leading-[1.18] text-white group-hover/link:text-brand-300 group-hover/link:translate-x-1.5 transition-all duration-300 line-clamp-3 max-w-4xl">
                {currentArticle.title}
              </h3>
            </Link>

            {/* Justified Summary without right-edge hyphenation */}
            <p className="text-xs sm:text-sm md:text-base text-slate-200 line-clamp-2 md:line-clamp-3 mb-5 max-w-3xl font-normal text-justify hyphens-none leading-relaxed hidden sm:block">
              {currentArticle.summary}
            </p>

            {/* CTA Button */}
            <div className="flex items-center gap-3">
              <Link
                href={`/noticia/${currentArticle.slug}`}
                prefetch={true}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 hover:bg-brand-600 text-white rounded-xl text-xs sm:text-sm font-black transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-md cursor-pointer group/btn"
              >
                <span>Ler Reportagem Completa</span>
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* 6-Second Auto-Transition Progress Bar */}
        <div className="w-full bg-slate-800/80 h-1 relative overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-600 via-brand-500 to-sky-400 transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 10-Category Thumbnail & Dot Navigation Bar */}
      <div className="mt-4 pt-2">
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          {slides.map((item, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={`${item.slug}-${idx}`}
                type="button"
                onClick={() => goToSlide(idx)}
                className={`flex flex-col text-left p-2 rounded-xl transition-all duration-200 cursor-pointer border ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-950/70 border-brand-500 shadow-sm scale-102 ring-2 ring-brand-500/20'
                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-brand-300 opacity-75 hover:opacity-100 hover:-translate-y-0.5'
                }`}
                title={`Ver destaque ${idx + 1}: ${item.category} - ${item.title}`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider truncate ${
                      isActive
                        ? 'text-brand-700 dark:text-brand-400'
                        : 'text-slate-500 dark:text-zinc-400'
                    }`}
                  >
                    {item.category}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {idx + 1}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-slate-800 dark:text-zinc-200 line-clamp-1 leading-tight">
                  {item.title}
                </p>
                {isActive && (
                  <div className="w-full bg-slate-200 dark:bg-zinc-700 h-0.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="bg-brand-600 h-full transition-all duration-75"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
