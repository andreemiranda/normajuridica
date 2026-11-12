'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, User, Bookmark, Volume2 } from 'lucide-react';
import { NewsItem } from '@/lib/types';
import { OptimizedImage } from './OptimizedImage';
import { toggleStoredBookmark, getStoredBookmarks } from '@/lib/accessibility';

interface NewsCardProps {
  news: NewsItem;
  variant?: 'grid' | 'compact';
  isBookmarked?: boolean;
  onBookmarkChange?: (id: string, saved: boolean) => void;
  onPlayAudio?: (item: NewsItem) => void;
}

export function NewsCard({
  news,
  variant = 'grid',
  isBookmarked: propIsBookmarked = false,
  onBookmarkChange,
  onPlayAudio,
}: NewsCardProps) {
  // Initialize with prop to guarantee 100% match between SSR and initial client hydration
  const [isBookmarked, setIsBookmarked] = React.useState(propIsBookmarked);
  const [prevProp, setPrevProp] = React.useState(propIsBookmarked);

  // Adjust state during render if prop changes (React recommended pattern)
  if (prevProp !== propIsBookmarked) {
    setPrevProp(propIsBookmarked);
    setIsBookmarked(propIsBookmarked);
  }

  // Read client-side storage ONLY after initial hydration mount to prevent SSR mismatch
  React.useEffect(() => {
    const newsId = news.id || news.slug;
    if (!newsId) return;

    const handleSync = () => {
      const currentList = getStoredBookmarks();
      setIsBookmarked(currentList.includes(newsId));
    };

    const timer = setTimeout(handleSync, 0);

    window.addEventListener('nj_bookmarks_change', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('nj_bookmarks_change', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [news.id, news.slug]);

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newsId = news.id || news.slug;
    const res = toggleStoredBookmark(newsId);
    setIsBookmarked(res.isBookmarked);
    if (onBookmarkChange) {
      onBookmarkChange(newsId, res.isBookmarked);
    }
  };

  const handleAudioClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPlayAudio) {
      onPlayAudio(news);
    }
  };

  if (variant === 'compact') {
    return (
      <article className="content-auto group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex gap-4 items-center">
        {/* Compact image container with overlay Link */}
        <div className="relative w-28 h-20 sm:w-36 sm:h-24 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-800">
          <OptimizedImage
            src={news.imageUrl || (news.images && news.images[0]) || ''}
            alt={news.title}
            fill
            sizes="150px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <Link
            href={`/noticia/${news.slug}`}
            prefetch={true}
            className="absolute inset-0 block focus:outline-none z-0"
            aria-label={news.title}
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700 dark:text-brand-400">
                {news.category}
              </span>
              <div className="flex items-center gap-1">
                {onPlayAudio && (
                  <button
                    type="button"
                    onClick={handleAudioClick}
                    className="p-1 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                    title="Ouvir matéria"
                    aria-label="Ouvir matéria"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleBookmarkClick}
                  className={`p-1 rounded-lg transition-colors ${
                    isBookmarked
                      ? 'text-brand-700 dark:text-brand-400'
                      : 'text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                  title={isBookmarked ? 'Remover dos salvos' : 'Salvar matéria'}
                  aria-label={isBookmarked ? 'Remover dos salvos' : 'Salvar matéria'}
                  aria-pressed={isBookmarked}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>

            <Link href={`/noticia/${news.slug}`} prefetch={true} className="focus:outline-none block group/title">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 group-hover:translate-x-1 line-clamp-2 leading-snug transition-all duration-200">
                {news.title}
              </h3>
            </Link>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-zinc-500 mt-2">
            <span className="truncate">{news.author || 'Norma Jurídica'}</span>
            <span>•</span>
            <span className="flex-shrink-0">{news.timeAgo}</span>
          </div>
        </div>
      </article>
    );
  }

  // Grid variant
  return (
    <article className="content-auto group flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      {/* 16:9 Image container with zoom on hover */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-zinc-800 block zoom-frame">
        <OptimizedImage
          src={news.imageUrl || (news.images && news.images[0]) || ''}
          alt={news.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover group-hover:scale-110 hover:scale-110 transition-transform duration-500 ease-out"
        />

        {/* Empty overlay Link - NO children so browser extensions cannot inject unwanted tags into the Link */}
        <Link
          href={`/noticia/${news.slug}`}
          prefetch={true}
          className="absolute inset-0 block focus:outline-none z-0"
          aria-label={news.title}
        />

        {/* Quick action buttons on image - separate from Link to prevent invalid HTML nesting and hydration mismatches */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity z-10 pointer-events-auto">
          {onPlayAudio && (
            <button
              type="button"
              onClick={handleAudioClick}
              className="p-1.5 bg-black/60 hover:bg-brand-700 backdrop-blur-md text-white rounded-xl shadow-md transition-colors"
              title="Ouvir matéria"
              aria-label="Ouvir notícia em áudio"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleBookmarkClick}
            className={`p-1.5 backdrop-blur-md rounded-xl shadow-md transition-colors ${
              isBookmarked
                ? 'bg-brand-700 text-white'
                : 'bg-black/60 hover:bg-brand-700 text-white'
            }`}
            title={isBookmarked ? 'Remover dos salvos' : 'Salvar matéria'}
            aria-label={isBookmarked ? 'Remover dos salvos' : 'Salvar matéria'}
            aria-pressed={isBookmarked}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 md:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Category Kicker */}
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-1.5">
            {news.category}
          </span>

          {/* Headline with link movement and color transition */}
          <Link href={`/noticia/${news.slug}`} prefetch={true} className="focus:outline-none block group/link">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 group-hover:translate-x-1 leading-snug line-clamp-3 mb-2.5 transition-all duration-200">
              {news.title}
            </h3>
          </Link>

          {/* Justified Summary without right-edge hyphenation */}
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 line-clamp-3 leading-relaxed mb-4 font-normal text-justify hyphens-none">
            {(news.summary || '').replace(/<[^>]+>/g, '').replace(/&lt;[^&]+&gt;/g, '').trim()}
          </p>
        </div>

        {/* Metadata footer */}
        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-zinc-500 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <span className="flex items-center gap-1.5 truncate max-w-[150px]">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{news.author || 'Norma Jurídica'}</span>
          </span>
          <span className="flex items-center gap-1.5 flex-shrink-0">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{news.timeAgo}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
