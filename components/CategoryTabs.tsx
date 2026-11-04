'use client';

import React from 'react';
import Link from 'next/link';
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
  const normActive = categorySlugify(activeCategory);
  const liveBookmarksCount = useBookmarksCount();
  const bookmarksCount =
    typeof propBookmarksCount === 'number' && propBookmarksCount > 0
      ? propBookmarksCount
      : liveBookmarksCount;

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

  return (
    <nav
      className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 shadow-xs"
      aria-label="Editorias e Categorias"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 space-y-1.5">
        {/* Linha 1: Grandes Temas e Editorias Centrais */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-wrap sm:flex-nowrap lg:flex-wrap">
          {THEMATIC_CATEGORIES.map(renderTabItem)}
        </div>

        {/* Linha 2: Estados e Regiões do Brasil + Minha Lista */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-wrap sm:flex-nowrap lg:flex-wrap pt-1 border-t border-slate-100 dark:border-zinc-800/60">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-zinc-500 mr-1 hidden md:inline">
            Regiões:
          </span>
          {REGIONAL_CATEGORIES.map(renderTabItem)}
        </div>
      </div>
    </nav>
  );
}
