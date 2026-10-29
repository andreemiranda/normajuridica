import React from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ALL_CATEGORIES, normalizeCategoryText } from '@/lib/sources';
import { categorySlugify } from '@/lib/slug';
import { getNewsItemBySlugOrId } from '@/lib/news-fetcher';
import { INSTITUTIONAL_PAGES } from '@/lib/wp';

export const revalidate = 60; // ISR 60s

interface CatchAllPageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: CatchAllPageProps): Promise<Metadata> {
  const { slug } = await params;
  const path = slug.join('/');

  if (slug[0] === 'videos') {
    return { title: 'Página Não Encontrada' };
  }

  // 1. Check category
  const normCat = normalizeCategoryText(slug[slug.length - 1]);
  const cat = ALL_CATEGORIES.find(c => c.slug === normCat || normalizeCategoryText(c.id) === normCat);
  if (cat) {
    return {
      title: `Notícias sobre ${cat.name}`,
      description: `Cobertura de ${cat.name} no Norma Jurídica.`,
    };
  }

  // 2. Check article
  const article = await getNewsItemBySlugOrId(slug[slug.length - 1]);
  if (article) {
    return {
      title: article.title,
      description: article.summary,
    };
  }

  // 3. Check institutional page
  const page = INSTITUTIONAL_PAGES[slug[slug.length - 1]];
  if (page) {
    return {
      title: page.title,
      description: page.lead,
    };
  }

  return { title: 'Página Não Encontrada' };
}

export default async function CatchAllPage({ params }: CatchAllPageProps) {
  const { slug } = await params;

  // Strict Rule 3: /videos MUST return 404
  if (slug[0] === 'videos') {
    notFound();
  }

  const singleSlug = slug[slug.length - 1];
  const decodedSlug = decodeURIComponent(singleSlug);
  const cleanCategorySlug = categorySlugify(decodedSlug);

  // 1. Resolve Category
  const matchedCategory = ALL_CATEGORIES.find(
    c => c.slug === cleanCategorySlug || normalizeCategoryText(c.id) === normalizeCategoryText(decodedSlug)
  );

  if (matchedCategory) {
    // 308 redirect to clean category url
    redirect(`/categoria/${matchedCategory.slug}`);
  }

  // 2. Resolve Article
  const article = await getNewsItemBySlugOrId(decodedSlug);
  if (article) {
    redirect(`/noticia/${article.slug}`);
  }

  // 3. Resolve Institutional Page
  if (INSTITUTIONAL_PAGES[decodedSlug] || INSTITUTIONAL_PAGES[cleanCategorySlug]) {
    const pageSlug = INSTITUTIONAL_PAGES[decodedSlug] ? decodedSlug : cleanCategorySlug;
    redirect(`/pagina/${pageSlug}`);
  }

  // 4. Not found
  notFound();
}
