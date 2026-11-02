'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, List, Sparkles, AlertCircle, Bookmark, Search, RefreshCw } from 'lucide-react';
import { NewsItem } from '@/lib/types';
import { Header } from '@/components/Header';
import { BreakingTicker } from '@/components/BreakingTicker';
import { CategoryTabs } from '@/components/CategoryTabs';
import { WeatherCard } from '@/components/WeatherCard';
import { FeaturedNews } from '@/components/FeaturedNews';
import { NewsCard } from '@/components/NewsCard';
import { Footer } from '@/components/Footer';
import { AdSenseBanner } from '@/components/AdSenseBanner';
import { SITE_CONFIG } from '@/lib/site-config';
import { resolveCategoryDisplayName } from '@/lib/sources';
import { useAllBookmarks } from '@/lib/accessibility';

export function HomePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('q') || '');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
  const bookmarkedIds = useAllBookmarks();

  // Check ?article= redirect as specified in Parte 4
  useEffect(() => {
    const articleParam = searchParams.get('article');
    if (articleParam) {
      router.replace(`/noticia/${encodeURIComponent(articleParam)}`);
    }
  }, [searchParams, router]);

  // Fetch news on mount or when category/search changes
  useEffect(() => {
    let isMounted = true;

    async function executeLoad() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (activeCategory === 'favoritos') {
          params.set('limit', '100');
        } else if (activeCategory && activeCategory !== 'all' && activeCategory !== 'todas') {
          params.set('category', activeCategory);
        }
        if (searchQuery) {
          params.set('q', searchQuery);
        }

        const res = await fetch(`/api/news?${params.toString()}`, { cache: 'no-store' });
        if (res.ok && isMounted) {
          const data = await res.json();
          setNews(data.items || []);
          setLastUpdatedTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        }
      } catch {
        // silent fail on initial load
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    executeLoad();

    return () => {
      isMounted = false;
    };
  }, [activeCategory, searchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeCategory === 'favoritos') {
        params.set('limit', '100');
      } else if (activeCategory && activeCategory !== 'all' && activeCategory !== 'todas') {
        params.set('category', activeCategory);
      }
      if (searchQuery) {
        params.set('q', searchQuery);
      }
      params.set('refresh', 'true');

      const res = await fetch(`/api/news?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha');
      const data = await res.json();
      setNews(data.items || []);
      setLastUpdatedTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setError('Não foi possível atualizar as notícias no momento. Verifique sua conexão e tente novamente.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCategorySelect = (cat: string) => {
    setActiveCategory(cat);
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
  };

  // Filter news for current display
  let displayedNews = news;

  // If in bookmarks tab
  if (activeCategory === 'favoritos') {
    displayedNews = news.filter(item => bookmarkedIds.includes(item.id || item.slug));
  }

  // Text search filtering on client
  if (searchQuery.trim()) {
    const qLower = searchQuery.toLowerCase().trim();
    displayedNews = displayedNews.filter(
      item =>
        item.title.toLowerCase().includes(qLower) ||
        item.summary.toLowerCase().includes(qLower) ||
        item.category.toLowerCase().includes(qLower) ||
        (item.author && item.author.toLowerCase().includes(qLower))
    );
  }

  const mainHighlights = displayedNews.slice(0, 10);
  const remainingNews = displayedNews.slice(10, 26);
  const moreNews = displayedNews.slice(26);
  const mostRead = [...news].slice(0, 5);

  const categoryTitle =
    activeCategory === 'favoritos'
      ? 'Minha Lista • Matérias Salvas'
      : activeCategory === 'all' || activeCategory === 'todas'
      ? 'Destaques'
      : resolveCategoryDisplayName(activeCategory);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-zinc-950">
      {/* Header */}
      <Header
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onSearch={handleSearch}
        onBookmarksClick={() => handleCategorySelect('favoritos')}
        bookmarksCount={bookmarkedIds.length}
      />

      {/* Breaking News Ticker */}
      <BreakingTicker news={news} />

      {/* Categories Horizontal Bar */}
      <CategoryTabs
        activeCategory={activeCategory}
        setActiveCategory={handleCategorySelect}
        bookmarksCount={bookmarkedIds.length}
      />

      {/* Main Container */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {/* Top Feature Bar: Headline statement + WeatherCard */}
        <section className="mb-8 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-sm">
          <div className="max-w-2xl">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-zinc-50 tracking-tight leading-tight">
              Acompanhe as principais informações de economia, justiça, política e acontecimentos do Brasil.
            </h1>
          </div>

          <div className="flex-shrink-0">
            <WeatherCard />
          </div>
        </section>

        {/* Header Ad Slot */}
        <div className="mb-8">
          <AdSenseBanner slot={SITE_CONFIG.adsense.slots.header} />
        </div>

        {/* Section Control Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              {categoryTitle}
              {searchQuery && (
                <span className="text-sm font-normal text-slate-500">
                  (busca por: &quot;{searchQuery}&quot;)
                </span>
              )}
            </h2>
          </div>

          {/* View mode switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-zinc-800 text-brand-700 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
              title="Exibição em Grade"
              aria-label="Exibição em grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-white dark:bg-zinc-800 text-brand-700 dark:text-brand-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
              title="Exibição em Lista Compacta"
              aria-label="Exibição compacta"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-center gap-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && news.length === 0 ? (
          <div className="space-y-8 animate-pulse">
            <div className="aspect-[16/9] w-full bg-slate-200 dark:bg-zinc-800 rounded-3xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-64 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
              <div className="h-64 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
              <div className="h-64 bg-slate-200 dark:bg-zinc-800 rounded-2xl" />
            </div>
          </div>
        ) : displayedNews.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8">
            <div className="w-16 h-16 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              {activeCategory === 'favoritos' ? <Bookmark className="w-8 h-8" /> : <Search className="w-8 h-8" />}
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-zinc-100 mb-2">
              {activeCategory === 'favoritos'
                ? 'Nenhuma matéria salva ainda'
                : 'Nenhuma matéria encontrada'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              {activeCategory === 'favoritos'
                ? 'Clique no ícone de marcador nas matérias que deseja salvar para leitura posterior.'
                : 'Tente utilizar termos mais abrangentes ou selecione outra editoria.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
                handleRefresh();
              }}
              className="px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Ver todas as notícias</span>
            </button>
          </div>
        ) : (
          /* Main Content Layout: Grid 12 (col-8 + col-4) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Main Stream (col-8) */}
            <div className="lg:col-span-8 space-y-10">
              {/* Featured News Hero only in 'all' view without search query */}
              {activeCategory === 'all' && !searchQuery && (
                <FeaturedNews news={mainHighlights} />
              )}

              {/* Feed of remaining news */}
              <section aria-label="Notícias Recentes">
                <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-6' : 'space-y-4'}>
                  {(activeCategory === 'all' && !searchQuery ? remainingNews : displayedNews).map(item => (
                    <NewsCard
                      key={item.slug}
                      news={item}
                      variant={viewMode}
                      isBookmarked={bookmarkedIds.includes(item.id || item.slug)}
                    />
                  ))}
                </div>
              </section>

              {/* In-feed Ad Banner */}
              <AdSenseBanner slot={SITE_CONFIG.adsense.slots.inArticle} />

              {/* More News & Analysis */}
              {activeCategory === 'all' && !searchQuery && moreNews.length > 0 && (
                <section aria-label="Mais Notícias e Análises">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-1.5 h-6 bg-brand-700 rounded-full" />
                    <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                      Mais Notícias e Análises
                    </h3>
                  </div>

                  <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-6' : 'space-y-4'}>
                    {moreNews.map(item => (
                      <NewsCard
                        key={item.slug}
                        news={item}
                        variant={viewMode}
                        isBookmarked={bookmarkedIds.includes(item.id || item.slug)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar (col-4) */}
            <aside className="lg:col-span-4 space-y-8">
              <div className="sticky top-20 space-y-8">
                {/* Sidebar Advertisement */}
                <AdSenseBanner slot={SITE_CONFIG.adsense.slots.sidebar} />

                {/* "Mais Lidas • Em Alta" */}
                {mostRead.length > 0 && (
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
                      <div className="w-1.5 h-5 bg-brand-700 rounded-full" />
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-zinc-100">
                        Mais Lidas • Em Alta
                      </h3>
                    </div>

                    <div className="space-y-4">
                      {mostRead.map((item, idx) => (
                        <div key={item.slug} className="group flex gap-3.5 items-start">
                          <span className="text-3xl font-black text-brand-700 dark:text-brand-400 w-6 flex-shrink-0 text-center leading-none">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700 dark:text-brand-400 block mb-0.5">
                              {item.category}
                            </span>
                            <a
                              href={`/noticia/${item.slug}`}
                              className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 group-hover:text-brand-700 dark:group-hover:text-brand-400 line-clamp-2 leading-snug transition-colors"
                            >
                              {item.title}
                            </a>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              {item.timeAgo}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sidebar Bottom Advertisement */}
                <AdSenseBanner slot={SITE_CONFIG.adsense.slots.sidebarBottom} />
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
