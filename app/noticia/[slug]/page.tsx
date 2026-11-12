import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getNewsItemBySlugOrId, fetchNews } from '@/lib/news-fetcher';
import { ArticlePageClient } from '@/components/ArticlePageClient';
import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { Footer } from '@/components/Footer';
import { SITE_CONFIG, getBaseUrl } from '@/lib/site-config';
import { generateNewsArticleSchema } from '@/lib/seo';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export const revalidate = 20; // ISR 20s


interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getNewsItemBySlugOrId(slug);
  const baseUrl = getBaseUrl();

  if (!article) {
    return {
      title: 'Matéria Não Encontrada',
      description: 'A notícia solicitada não foi encontrada ou está indisponível no momento.',
    };
  }

  const canonicalUrl = `${baseUrl}/noticia/${article.slug}`;
  const ogImg = article.imageUrl && article.imageUrl.startsWith('http')
    ? article.imageUrl
    : `${baseUrl}/cover.png`;

  return {
    title: article.title,
    description: article.summary,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${article.title} | ${SITE_CONFIG.name}`,
      description: article.summary,
      url: canonicalUrl,
      type: 'article',
      publishedTime: article.isoDate || article.pubDate,
      authors: [article.author || SITE_CONFIG.name],
      section: article.category,
      images: [
        {
          url: ogImg,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${article.title} | ${SITE_CONFIG.name}`,
      description: article.summary,
      images: [ogImg],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getNewsItemBySlugOrId(slug);

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950">
        <Header />
        <CategoryTabs />

        <main className="flex-1 max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 mb-3">
            Matéria não encontrada ou indisponível
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400 mb-8 max-w-md mx-auto">
            O conteúdo solicitado pode ter sido atualizado, renomeado ou arquivado pela redação do Norma Jurídica.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar à Página Inicial</span>
          </Link>
        </main>

        <Footer />
      </div>
    );
  }

  // Fetch related news from same category and most read
  const { items: allNews } = await fetchNews({ category: article.category, limit: 10 });
  const related = allNews.filter(n => n.slug !== article.slug);
  const mostRead = allNews.slice(0, 5);

  const baseUrl = getBaseUrl();
  const articleSchema = generateNewsArticleSchema(article, baseUrl);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <Header />
      <CategoryTabs activeCategory={article.category} />

      <ArticlePageClient
        article={article}
        relatedNews={related}
        mostReadNews={mostRead}
        adsenseSlots={SITE_CONFIG.adsense.slots}
      />

      <Footer />
    </div>
  );
}
