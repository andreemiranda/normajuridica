import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getNewsItemBySlugOrId, fetchNews } from '@/lib/news-fetcher';
import { ArticlePageClient } from '@/components/ArticlePageClient';
import { Header } from '@/components/Header';
import { CategoryTabs } from '@/components/CategoryTabs';
import { Footer } from '@/components/Footer';
import { SITE_CONFIG, getBaseUrl } from '@/lib/site-config';
import { generateNewsArticleSchema } from '@/lib/seo';

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
  const article = await getNewsItemBySlugOrId(slug, { resolveApiLinks: true });

  if (!article) {
    redirect('/');
  }

  // Fetch related news from same category and most read
  const { items: allNews } = await fetchNews({ category: article.category, limit: 10 });
  const related = allNews.filter(n => n.slug !== article.slug);
  const mostRead = allNews.slice(0, 5);

  const baseUrl = getBaseUrl();
  const articleSchema = generateNewsArticleSchema(article, baseUrl);
  const rawAppUrl = (process.env.APP_URL || '').trim();
  const appUrl =
    rawAppUrl && !rawAppUrl.includes('MY_APP_URL')
      ? rawAppUrl.replace(/\/+$/, '')
      : '';

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
        appUrl={appUrl}
        adsenseSlots={SITE_CONFIG.adsense.slots}
      />

      <Footer />
    </div>
  );
}
