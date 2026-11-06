'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  User,
} from 'lucide-react';
import { NewsItem } from '@/lib/types';
import { OptimizedImage } from './OptimizedImage';

interface FeaturedNewsProps {
  news: NewsItem[];
}

export function FeaturedNews({ news }: FeaturedNewsProps) {
  const slides = news.slice(0, 10);
  const totalSlides = slides.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance slide every 6 seconds with progress bar
  useEffect(() => {
    if (totalSlides <= 1) return;

    if (isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    const duration = 6000;
    const intervalStep = 60;
    let elapsed = 0;

    progressIntervalRef.current = setInterval(() => {
      elapsed += intervalStep;
      setProgress((elapsed / duration) * 100);
    }, intervalStep);

    timerRef.current = setTimeout(() => {
      setProgress(0);
      setCurrentIndex(prev => (prev + 1) % totalSlides);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [currentIndex, isPaused, totalSlides]);

  if (slides.length === 0) return null;

  const currentArticle = slides[currentIndex];

  return (
    <section
      className="mb-10"
      aria-label="Destaques Principais"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Main Slide Card in 16:9 Format */}
      <div
        className="relative w-full aspect-[16/9] rounded-3xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-zinc-800 shadow-xl group"
        suppressHydrationWarning
      >
        <div
          className="relative w-full h-full overflow-hidden zoom-frame"
          suppressHydrationWarning
          data-pin-nopin="true"
          data-pin-no-hover="true"
        >
          <OptimizedImage
            key={currentArticle.slug}
            src={currentArticle.imageUrl || (currentArticle.images && currentArticle.images[0]) || '/cover.png'}
            alt={currentArticle.title}
            fill
            priority={true}
            sizes="(max-width: 1024px) 100vw, 1200px"
            className="object-cover group-hover:scale-105 hover:scale-105 transition-transform duration-700 ease-out"
          />

          {/* Editorial dark gradient for high readability */}
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

            {/* Headline */}
            <Link
              href={`/noticia/${currentArticle.slug}`}
              prefetch={true}
              className="block group/link focus:outline-none mb-3"
            >
              <h3 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-snug text-white group-hover/link:text-brand-300 transition-all duration-300 line-clamp-3 max-w-4xl">
                {currentArticle.title}
              </h3>
            </Link>

            {/* Justified Summary without right-edge hyphenation */}
            <p className="text-xs sm:text-sm md:text-base text-slate-200 line-clamp-2 md:line-clamp-3 mb-4 max-w-3xl font-normal text-justify hyphens-none leading-relaxed hidden sm:block">
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

        {/* Auto-Transition Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-slate-800/80 h-1 overflow-hidden z-20">
          <div
            className="h-full bg-gradient-to-r from-brand-600 via-brand-500 to-sky-400 transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </section>
  );
}
