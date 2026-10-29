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
} from 'lucide-react';
import { categorySlugify } from '@/lib/slug';

export interface PopularCategory {
  id: string;
  name: string;
  slug: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const POPULAR_CATEGORIES: PopularCategory[] = [
  { id: 'all', name: 'Todas as Notícias', slug: 'todas', icon: Newspaper },
  { id: 'Política', name: 'Política', slug: 'politica', icon: Landmark },
  { id: 'Economia', name: 'Economia', slug: 'economia', icon: TrendingUp },
  { id: 'Justiça', name: 'Justiça', slug: 'justica', icon: Scale },
  { id: 'Saúde', name: 'Saúde', slug: 'saude', icon: HeartPulse },
  { id: 'Educação', name: 'Educação', slug: 'educacao', icon: GraduationCap },
  { id: 'Cultura', name: 'Cultura', slug: 'cultura', icon: Palette },
  { id: 'Esporte', name: 'Esporte', slug: 'esporte', icon: Trophy },
  { id: 'Tecnologia e Games', name: 'Tecnologia & Games', slug: 'tecnologia-e-games', icon: Gamepad2 },
  { id: 'Notícias Gerais', name: 'Gerais', slug: 'noticias-gerais', icon: Newspaper },
  { id: 'Pará', name: 'Pará', slug: 'para', icon: MapPin },
  { id: 'Tocantins', name: 'Tocantins', slug: 'tocantins', icon: MapPin },
  { id: 'Goiás', name: 'Goiás', slug: 'goias', icon: MapPin },
  { id: 'Santa Catarina', name: 'Santa Catarina', slug: 'santa-catarina', icon: MapPin },
  { id: 'Mundo', name: 'Mundo', slug: 'mundo', icon: Globe2 },
  { id: 'favoritos', name: 'Minha Lista', slug: 'favoritos', icon: Bookmark },
];

interface CategoryTabsProps {
  activeCategory?: string;
  setActiveCategory?: (cat: string) => void;
  bookmarksCount?: number;
}

export function CategoryTabs({
  activeCategory = 'all',
  setActiveCategory,
  bookmarksCount = 0,
}: CategoryTabsProps) {
  const normActive = categorySlugify(activeCategory);

  return (
    <nav
      className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 shadow-sm"
      aria-label="Editorias e Categorias"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2.5">
          {POPULAR_CATEGORIES.map(cat => {
            const isFavorite = cat.id === 'favoritos';
            const isActive =
              normActive === cat.slug ||
              (cat.slug === 'todas' && (normActive === 'all' || normActive === 'todas'));

            const Icon = cat.icon;

            const content = (
              <span
                className={`relative px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 select-none ${
                  isActive
                    ? 'text-brand-700 dark:text-brand-400 bg-brand-50/80 dark:bg-brand-950/40 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-brand-700 dark:hover:text-brand-400 hover:bg-slate-100/60 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-brand-700 dark:text-brand-400'
                      : isFavorite
                      ? 'text-amber-500'
                      : 'text-slate-400 dark:text-zinc-500'
                  }`}
                />
                <span>{cat.name}</span>
                {isFavorite && bookmarksCount > 0 && (
                  <span className="bg-brand-700 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full" suppressHydrationWarning>
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
                  className="cursor-pointer focus:outline-none focus-visible:ring-2 ring-brand-500 rounded-xl"
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
                className="focus:outline-none focus-visible:ring-2 ring-brand-500 rounded-xl"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
