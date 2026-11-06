'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Newspaper,
  Landmark,
  TrendingUp,
  Scale,
  HeartPulse,
  GraduationCap,
  Palette,
  Trophy,
  Gamepad2,
  Globe2,
  MapPin,
  Bookmark,
  Coins,
  Film,
  Flag,
  ChevronDown,
  Check,
  Compass,
} from 'lucide-react';
import { categorySlugify } from '@/lib/slug';
import { useBookmarksCount } from '@/lib/accessibility';

export interface PopularCategory {
  id: string;
  name: string;
  slug: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const THEMATIC_CATEGORIES: PopularCategory[] = [
  { id: 'all', name: 'Todas as Notícias', slug: 'todas', icon: Newspaper },
  { id: 'Mundo', name: 'Mundo', slug: 'mundo', icon: Globe2 },
  { id: 'Brasil', name: 'Brasil', slug: 'brasil', icon: Flag },
  { id: 'Política', name: 'Política', slug: 'politica', icon: Landmark },
  { id: 'Economia', name: 'Economia', slug: 'economia', icon: TrendingUp },
  { id: 'Justiça', name: 'Justiça', slug: 'justica', icon: Scale },
  { id: 'Saúde', name: 'Saúde', slug: 'saude', icon: HeartPulse },
  { id: 'Educação', name: 'Educação', slug: 'educacao', icon: GraduationCap },
  { id: 'Cultura', name: 'Cultura', slug: 'cultura', icon: Palette },
  { id: 'Esporte', name: 'Esporte', slug: 'esporte', icon: Trophy },
  { id: 'Tecnologia e Games', name: 'Tecnologia & Games', slug: 'tecnologia-e-games', icon: Gamepad2 },
  { id: 'Finanças', name: 'Finanças', slug: 'financas', icon: Coins },
  { id: 'Pop & Arte', name: 'Pop & Arte', slug: 'pop-e-arte', icon: Film },
];

export const REGIONAL_CATEGORIES: PopularCategory[] = [
  { id: 'Pará', name: 'Pará', slug: 'para', icon: MapPin },
  { id: 'Tocantins', name: 'Tocantins', slug: 'tocantins', icon: MapPin },
  { id: 'Goiás', name: 'Goiás', slug: 'goias', icon: MapPin },
  { id: 'Santa Catarina', name: 'Santa Catarina', slug: 'santa-catarina', icon: MapPin },
  { id: 'Paraná', name: 'Paraná', slug: 'parana', icon: MapPin },
  { id: 'Maranhão', name: 'Maranhão', slug: 'maranhao', icon: MapPin },
  { id: 'Rio Grande do Sul', name: 'Rio Grande do Sul', slug: 'rio-grande-do-sul', icon: MapPin },
  { id: 'Amazonas', name: 'Amazonas', slug: 'amazonas', icon: MapPin },
  { id: 'Minas Gerais', name: 'Minas Gerais', slug: 'grande-minas', icon: MapPin },
];

export const POPULAR_CATEGORIES: PopularCategory[] = [
  ...THEMATIC_CATEGORIES,
  ...REGIONAL_CATEGORIES,
];

interface CategoryTabsProps {
  activeCategory?: string;
  setActiveCategory?: (cat: string) => void;
  bookmarksCount?: number;
}

export function CategoryTabs({
  activeCategory = 'all',
  setActiveCategory,
  bookmarksCount: propBookmarksCount,
}: CategoryTabsProps) {
  const router = useRouter();
  const normActive = categorySlugify(activeCategory);
  const liveBookmarksCount = useBookmarksCount();
  const bookmarksCount =
    typeof propBookmarksCount === 'number' && propBookmarksCount > 0
      ? propBookmarksCount
      : liveBookmarksCount;

  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMobileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine active category object and name for mobile display
  const activeCatObj =
    POPULAR_CATEGORIES.find(
      c => c.slug === normActive || (c.slug === 'todas' && (normActive === 'all' || normActive === 'todas'))
    ) || {
      id: activeCategory,
      name: activeCategory === 'all' || activeCategory === 'todas' ? 'Todas as Notícias' : activeCategory,
      slug: normActive,
      icon: Newspaper,
    };

  const handleCategoryPick = (cat: PopularCategory) => {
    setIsMobileDropdownOpen(false);
    if (setActiveCategory) {
      setActiveCategory(cat.id);
    } else {
      router.push(cat.slug === 'todas' ? '/' : `/categoria/${cat.slug}`);
    }
  };

  const renderTabItem = (cat: PopularCategory) => {
    const isFavorite = cat.id === 'favoritos';
    const isActive =
      normActive === cat.slug ||
      (cat.slug === 'todas' && (normActive === 'all' || normActive === 'todas'));

    const Icon = cat.icon;

    const content = (
      <span
        className={`relative px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all duration-200 select-none ${
          isActive
            ? 'text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 shadow-xs ring-1 ring-brand-200 dark:ring-brand-800'
            : 'text-slate-600 dark:text-zinc-400 hover:text-brand-700 dark:hover:text-brand-400 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60'
        }`}
      >
        <Icon
          className={`w-3.5 h-3.5 flex-shrink-0 ${
            isActive
              ? 'text-brand-700 dark:text-brand-400'
              : isFavorite
              ? 'text-amber-500'
              : 'text-slate-400 dark:text-zinc-500'
          }`}
        />
        <span>{cat.name}</span>
        {isFavorite && (
          <span
            className="bg-brand-700 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-[18px] text-center"
            suppressHydrationWarning
          >
            {bookmarksCount}
          </span>
        )}
        {isActive && (
          <motion.span
            layoutId="activeCategoryUnderline"
            className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-700 dark:bg-brand-500 rounded-full"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
      </span>
    );

    if (setActiveCategory) {
      return (
        <button
          key={cat.id}
          type="button"
          onClick={() => setActiveCategory(cat.id)}
          className="cursor-pointer focus:outline-none focus-visible:ring-2 ring-brand-500 rounded-xl flex-shrink-0"
          aria-pressed={isActive}
        >
          {content}
        </button>
      );
    }

    return (
      <Link
        key={cat.id}
        href={cat.slug === 'todas' ? '/' : `/categoria/${cat.slug}`}
        prefetch={true}
        className="focus:outline-none focus-visible:ring-2 ring-brand-500 rounded-xl flex-shrink-0"
      >
        {content}
      </Link>
    );
  };

  const ActiveIcon = activeCatObj.icon;

  return (
    <nav
      className="relative z-40 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shadow-xs"
      aria-label="Editorias e Categorias"
    >
      <div className="max-w-7xl mx-auto px-4 py-2">
        {/* MOBILE DROPDOWN (Visível em dispositivos móveis < sm) */}
        <div className="sm:hidden relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsMobileDropdownOpen(prev => !prev)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl shadow-xs transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-2 ring-brand-500"
            aria-expanded={isMobileDropdownOpen}
            aria-label="Selecionar editoria ou categoria"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1.5 rounded-lg bg-brand-700 text-white">
                <ActiveIcon className="w-4 h-4" />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-400">
                  Editoria Selecionada
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-zinc-100 truncate">
                  {activeCatObj.name}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 pl-2">
              <span className="text-[11px] font-bold">Mudar</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMobileDropdownOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Dropdown Menu Modal/Popover */}
          {isMobileDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl z-50 p-3 max-h-[75vh] overflow-y-auto space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800 px-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-brand-600" />
                  Navegar por Editorias
                </span>
                <span className="text-[10px] text-slate-400">Toque para filtrar</span>
              </div>

              {/* Temas Principais */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block mb-1.5 px-1">
                  Temas Centrais
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {THEMATIC_CATEGORIES.map(cat => {
                    const isSelected =
                      normActive === cat.slug ||
                      (cat.slug === 'todas' && (normActive === 'all' || normActive === 'todas'));
                    const CatIcon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleCategoryPick(cat)}
                        className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-brand-700 text-white shadow-xs'
                            : 'bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <CatIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-slate-400 dark:text-zinc-400'}`} />
                        <span className="truncate flex-1">{cat.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Regiões e Estados */}
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block mb-1.5 px-1">
                  Estados &amp; Regiões
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {REGIONAL_CATEGORIES.map(cat => {
                    const isSelected = normActive === cat.slug;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleCategoryPick(cat)}
                        className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-brand-700 text-white shadow-xs'
                            : 'bg-slate-50 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-slate-400 dark:text-zinc-400'}`} />
                        <span className="truncate flex-1">{cat.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DESKTOP & TABLET HORIZONTAL BAR (Visível em sm+) */}
        <div className="hidden sm:block space-y-1.5">
          {/* Linha 1: Grandes Temas e Editorias Centrais */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-wrap sm:flex-nowrap lg:flex-wrap">
            {THEMATIC_CATEGORIES.map(renderTabItem)}
          </div>

          {/* Linha 2: Estados e Regiões do Brasil */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-wrap sm:flex-nowrap lg:flex-wrap pt-1 border-t border-slate-100 dark:border-zinc-800/60">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-zinc-500 mr-1 hidden md:inline">
              Regiões:
            </span>
            {REGIONAL_CATEGORIES.map(renderTabItem)}
          </div>
        </div>
      </div>
    </nav>
  );
}
