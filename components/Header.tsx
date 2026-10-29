'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Layers,
  FileText,
  Mail,
  Sun,
  Moon,
  Search,
  RotateCw,
  Bookmark,
  Type,
} from 'lucide-react';
import { SITE_CONFIG } from '@/lib/site-config';
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
  const bookmarksCount = typeof propBookmarksCount === 'number' ? propBookmarksCount : storeBookmarksCount;
  const [searchQuery, setSearchQuery] = useState('');

  const [clock, setClock] = useState({ date: 'Brasília, DF', time: '12:00' });

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      setClock({
        date: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
        time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      });
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
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

  return (
    <header className="w-full bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
      {/* Top Utility Bar */}
      <div className="bg-zinc-950 text-slate-300 text-xs py-1.5 px-4 border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Date & live indicator */}
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-200" suppressHydrationWarning>
              {clock.date}
            </span>
            <span className="hidden md:inline text-zinc-600">•</span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span suppressHydrationWarning>Atualizado às {clock.time}</span>
            </span>
          </div>

          {/* Utility links and controls */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link
              href="/categoria"
              className="hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-brand-400" />
              <span>Editorias</span>
            </Link>

            <Link
              href="/pagina"
              className="hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-brand-400" />
              <span>Institucional</span>
            </Link>

            <Link
              href="/contato"
              className="hover:text-white flex items-center gap-1 text-[11px] font-medium transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-brand-400" />
              <span>Contato</span>
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
              <span suppressHydrationWarning>{fontSize === 'normal' ? 'A' : fontSize === 'large' ? 'A+' : 'A++'}</span>
            </button>

            {/* Dark / Light mode toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              suppressHydrationWarning
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

            {/* Minha Lista (Bookmarks) */}
            <button
              id="bookmarks-tab-button"
              type="button"
              onClick={onBookmarksClick}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-zinc-900 hover:bg-brand-50 dark:hover:bg-brand-950/60 text-slate-700 dark:text-zinc-300 hover:text-brand-700 dark:hover:text-brand-400 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs md:text-sm font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 ring-brand-500"
              title="Acessar Minha Lista de matérias salvas"
              aria-label="Minha Lista de matérias salvas"
            >
              <Bookmark className={`w-4 h-4 ${bookmarksCount > 0 ? 'text-brand-700 dark:text-brand-400 fill-current' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Minha Lista</span>
              <span className="bg-brand-700 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full" suppressHydrationWarning>
                {bookmarksCount}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
