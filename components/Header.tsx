'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Users,
  Mail,
  Scale,
  Sun,
  Moon,
  Search,
  RotateCw,
  Bookmark,
  Type,
  X,
  MapPin,
  Newspaper,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { SITE_CONFIG } from '@/lib/site-config';
import { ALL_CATEGORIES } from '@/lib/sources';
import { CategoryInfo } from '@/lib/types';
import {
  useIsClient,
  useTheme,
  useFontSize,
  useBookmarksCount,
  setStoredTheme,
  setStoredFontSize,
  FontSizeLevel,
} from '@/lib/accessibility';

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onSearch?: (query: string) => void;
  onBookmarksClick?: () => void;
  bookmarksCount?: number;
}

export function Header({
  onRefresh,
  isRefreshing = false,
  onSearch,
  onBookmarksClick,
  bookmarksCount: propBookmarksCount,
}: HeaderProps) {
  const router = useRouter();
  const isClient = useIsClient();
  const theme = useTheme();
  const fontSize = useFontSize();
  const storeBookmarksCount = useBookmarksCount();
  const bookmarksCount =
    storeBookmarksCount > 0
      ? storeBookmarksCount
      : (typeof propBookmarksCount === 'number' && propBookmarksCount > 0 ? propBookmarksCount : storeBookmarksCount);

  const [searchQuery, setSearchQuery] = useState('');
  const [isListDrawerOpen, setIsListDrawerOpen] = useState(false);
  const [drawerCategories, setDrawerCategories] = useState<CategoryInfo[]>(ALL_CATEGORIES);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isListDrawerOpen) return;
    let active = true;
    fetch('/api/categories')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (active && data?.categories && Array.isArray(data.categories) && data.categories.length > 0) {
          setDrawerCategories(data.categories);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isListDrawerOpen]);

  const [clock, setClock] = useState({ date: 'Brasília, DF', time: '12:00:00' });

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const timeStr = now.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setClock({
        date: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
        time: timeStr,
      });
    };
    updateClock();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      updateClock();
    }, 1000);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        updateClock();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, []);

  // Close drawer on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsListDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setStoredTheme(next);
  };

  const cycleFontSize = () => {
    const next: FontSizeLevel = fontSize === 'normal' ? 'large' : fontSize === 'large' ? 'xlarge' : 'normal';
    setStoredFontSize(next);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (onSearch) {
      onSearch(q);
    } else {
      router.push(q ? `/?q=${encodeURIComponent(q)}` : '/');
    }
  };

  const handleMinhaListaClick = () => {
    setIsListDrawerOpen(prev => !prev);
  };

  const handleViewSavedFeed = () => {
    setIsListDrawerOpen(false);
    if (onBookmarksClick) {
      onBookmarksClick();
    } else {
      router.push('/?cat=favoritos');
    }
  };

  const thematicCategories = drawerCategories.filter(c => c.group === 'tema');
  const regionalCategories = drawerCategories.filter(c => c.group === 'regiao');

  return (
    <header className="w-full bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 relative z-50">
      {/* Top Utility Bar */}
      <div className="bg-zinc-950 text-slate-300 text-xs py-1.5 px-4 border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Date & Brasília live clock with seconds */}
          <div className="flex items-center gap-2.5">
            <span className="font-medium text-slate-200">
              {clock.date}
            </span>
            <span className="text-zinc-600">•</span>
            <span className="font-mono font-semibold text-slate-300 text-xs tracking-wider">
              {clock.time}
            </span>
          </div>

          {/* New Editorial Menus */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link
              href="/pagina/editorial"
              className="hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-400" />
              <span>Editorial</span>
            </Link>

            <Link
              href="/pagina/expediente"
              className="hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-brand-400" />
              <span>Expediente</span>
            </Link>

            <Link
              href="/pagina/fale-conosco"
              className="hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-brand-400" />
              <span>Fale Conosco</span>
            </Link>

            <Link
              href="/pagina/linha-editorial"
              className="hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
            >
              <Scale className="w-3.5 h-3.5 text-brand-400" />
              <span>Linha Editorial</span>
            </Link>

            <span className="text-zinc-700 hidden sm:inline">|</span>

            {/* Font size controller */}
            <button
              type="button"
              onClick={cycleFontSize}
              className="hover:text-white flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
              title="Ajustar tamanho da fonte (A- / A / A+ / A++)"
              aria-label="Ajustar tamanho da fonte"
            >
              <Type className="w-3 h-3 text-brand-400" />
              <span>{fontSize === 'normal' ? 'A' : fontSize === 'large' ? 'A+' : 'A++'}</span>
            </button>

            {/* Dark / Light mode toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="hover:text-white flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              aria-pressed={theme === 'dark'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-brand-400" />
                  <span>Modo Escuro</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Masthead */}
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Tagline */}
          <Link href="/" className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 ring-brand-500 rounded-2xl transition-all duration-200 hover:-translate-y-0.5">
            {/* NJ Monogram Box */}
            <div className="w-12 h-12 md:w-14 md:h-14 bg-brand-700 rounded-2xl flex items-center justify-center text-white font-black text-2xl md:text-3xl tracking-tighter shadow-md ring-4 ring-brand-100 dark:ring-brand-950/50 group-hover:bg-brand-800 transition-all duration-300">
              NJ
            </div>

            <div>
              <div className="text-2xl md:text-3xl font-black tracking-tighter leading-none">
                <span className="text-slate-900 dark:text-zinc-100">NORMA </span>
                <span className="text-brand-700 dark:text-brand-400">JURÍDICA</span>
              </div>
              <p className="text-[11px] md:text-xs text-slate-500 dark:text-zinc-400 font-medium tracking-tight mt-1">
                {SITE_CONFIG.tagline}
              </p>
            </div>
          </Link>

          {/* Search bar & Action Buttons */}
          <div className="w-full md:w-auto flex items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-72">
              <label htmlFor="search-input" className="sr-only">
                Buscar notícias
              </label>
              <input
                id="search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar notícias, leis, análises..."
                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs md:text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </form>

            {/* Refresh button */}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2.5 bg-slate-100 dark:bg-zinc-900 hover:bg-brand-50 dark:hover:bg-brand-950/60 text-slate-700 dark:text-zinc-300 hover:text-brand-700 dark:hover:text-brand-400 rounded-xl border border-slate-200 dark:border-zinc-800 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 ring-brand-500"
                title="Atualizar feed de notícias"
                aria-label="Atualizar feed de notícias"
              >
                <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-600' : ''}`} />
              </button>
            )}

            {/* Minha Lista no Canto Superior Direito (Abrindo Menu de Categorias e Itens Salvos) */}
            <div className="relative">
              <button
                id="bookmarks-tab-button"
                type="button"
                onClick={handleMinhaListaClick}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs md:text-sm font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 ring-brand-500 ${
                  isListDrawerOpen
                    ? 'bg-brand-700 text-white border-brand-700 shadow-md'
                    : 'bg-slate-100 dark:bg-zinc-900 hover:bg-brand-50 dark:hover:bg-brand-950/60 text-slate-700 dark:text-zinc-300 hover:text-brand-700 dark:hover:text-brand-400 border-slate-200 dark:border-zinc-800'
                }`}
                title="Acessar Minha Lista e Todas as Categorias"
                aria-label="Minha Lista e Todas as Categorias"
                aria-expanded={isListDrawerOpen}
              >
                <Bookmark className={`w-4 h-4 ${isListDrawerOpen || bookmarksCount > 0 ? 'text-brand-300 dark:text-brand-400 fill-current' : 'text-slate-400'}`} />
                <span>Minha Lista</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center transition-colors ${
                    bookmarksCount > 0
                      ? 'bg-brand-700 dark:bg-brand-600 text-white'
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                  }`}
                  suppressHydrationWarning
                >
                  {bookmarksCount}
                </span>
              </button>

              {/* Minha Lista Dropdown & Category Hub Modal */}
              {isListDrawerOpen && (
                <>
                  <div
                    className="fixed inset-0 bg-black/40 z-40 backdrop-blur-xs"
                    onClick={() => setIsListDrawerOpen(false)}
                  />

                  <div
                    ref={drawerRef}
                    className="absolute right-0 top-full mt-2 w-[340px] sm:w-[480px] max-h-[85vh] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-y-auto flex flex-col"
                  >
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md z-10">
                      <div className="flex items-center gap-2">
                        <Bookmark className="w-4 h-4 text-brand-600 dark:text-brand-400 fill-current" />
                        <h3 className="text-sm font-black text-slate-900 dark:text-zinc-100">
                          Minha Lista &amp; Todas as Categorias
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsListDrawerOpen(false)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-4 space-y-5">
                      {/* Section 1: Saved Articles Action */}
                      <div className="p-3.5 bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900/60 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black uppercase tracking-wider text-brand-800 dark:text-brand-300">
                            Matérias Salvas
                          </span>
                          <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                            {bookmarksCount} {bookmarksCount === 1 ? 'matéria' : 'matérias'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 mb-3">
                          {bookmarksCount > 0
                            ? 'Acesse a listagem completa com todas as matérias adicionadas à sua lista de leitura.'
                            : 'Você ainda não salvou matérias. Clique no ícone de marcador nas notícias para salvá-las aqui.'}
                        </p>
                        <button
                          type="button"
                          onClick={handleViewSavedFeed}
                          className="w-full py-2 px-3 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>Ver Minha Lista no Feed</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Section 2: Todas as Categorias Temáticas */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Newspaper className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                            Categorias Temáticas ({thematicCategories.length})
                          </h4>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {thematicCategories.map(cat => (
                            <Link
                              key={cat.id}
                              href={cat.slug === 'todas' ? '/' : `/categoria/${cat.slug}`}
                              onClick={() => setIsListDrawerOpen(false)}
                              className="px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-zinc-300 hover:text-brand-700 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors truncate"
                            >
                              • {cat.name}
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Section 3: Todas as Coberturas Regionais e Estados */}
                      <div className="border-t border-slate-100 dark:border-zinc-800 pt-4">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <MapPin className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                            Estados &amp; Regiões do Brasil ({regionalCategories.length})
                          </h4>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {regionalCategories.map(cat => (
                            <Link
                              key={cat.id}
                              href={`/categoria/${cat.slug}`}
                              onClick={() => setIsListDrawerOpen(false)}
                              className="px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-zinc-300 hover:text-brand-700 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors truncate"
                            >
                              • {cat.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
