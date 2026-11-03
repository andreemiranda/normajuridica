'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  baseUrl?: string;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  baseUrl,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 2; // numbers to show around current page

    const range: number[] = [];
    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      pages.push(1, '...');
    } else {
      pages.push(1);
    }

    pages.push(...range);

    if (currentPage + delta < totalPages - 1) {
      pages.push('...', totalPages);
    } else if (totalPages > 1) {
      pages.push(totalPages);
    }

    return Array.from(new Set(pages));
  };

  const pages = getPageNumbers();

  const handlePageClick = (page: number, e?: React.MouseEvent) => {
    if (onPageChange) {
      if (e) e.preventDefault();
      onPageChange(page);
    }
  };

  const renderPageItem = (p: number | string, index: number) => {
    if (typeof p === 'string') {
      return (
        <span
          key={`ellipsis-${index}`}
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-400 font-bold text-xs"
        >
          …
        </span>
      );
    }

    const isActive = p === currentPage;

    if (baseUrl && !onPageChange) {
      return (
        <Link
          key={p}
          href={p === 1 ? baseUrl : `${baseUrl}?page=${p}`}
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            isActive
              ? 'bg-brand-700 text-white shadow-md'
              : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800'
          }`}
          aria-current={isActive ? 'page' : undefined}
        >
          {p}
        </Link>
      );
    }

    return (
      <button
        key={p}
        type="button"
        onClick={(e) => handlePageClick(p, e)}
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xs sm:text-sm font-bold transition-all cursor-pointer ${
          isActive
            ? 'bg-brand-700 text-white shadow-md ring-2 ring-brand-500/20'
            : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        {p}
      </button>
    );
  };

  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <nav
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-8 border-t border-slate-200 dark:border-zinc-800 ${className}`}
      aria-label="Navegação entre páginas de notícias"
    >
      <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400">
        Página <span className="font-bold text-slate-900 dark:text-zinc-100">{currentPage}</span> de{' '}
        <span className="font-bold text-slate-900 dark:text-zinc-100">{totalPages}</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {/* Previous button */}
        {baseUrl && !onPageChange ? (
          <Link
            href={prevPage === 1 ? baseUrl : `${baseUrl}?page=${prevPage}`}
            className={`px-3 py-2 rounded-xl flex items-center gap-1 text-xs sm:text-sm font-bold transition-all ${
              currentPage === 1
                ? 'opacity-40 pointer-events-none text-slate-400 bg-slate-100 dark:bg-zinc-900'
                : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800'
            }`}
            aria-disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Link>
        ) : (
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={(e) => handlePageClick(prevPage, e)}
            className={`px-3 py-2 rounded-xl flex items-center gap-1 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              currentPage === 1
                ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-100 dark:bg-zinc-900'
                : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>
        )}

        {/* Page buttons */}
        {pages.map(renderPageItem)}

        {/* Next button */}
        {baseUrl && !onPageChange ? (
          <Link
            href={`${baseUrl}?page=${nextPage}`}
            className={`px-3 py-2 rounded-xl flex items-center gap-1 text-xs sm:text-sm font-bold transition-all ${
              currentPage === totalPages
                ? 'opacity-40 pointer-events-none text-slate-400 bg-slate-100 dark:bg-zinc-900'
                : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800'
            }`}
            aria-disabled={currentPage === totalPages}
          >
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={(e) => handlePageClick(nextPage, e)}
            className={`px-3 py-2 rounded-xl flex items-center gap-1 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              currentPage === totalPages
                ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-100 dark:bg-zinc-900'
                : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800'
            }`}
          >
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </nav>
  );
}
