// lib/seo.ts
import { SITE_CONFIG, getBaseUrl } from './site-config';
import { NewsItem } from './types';

export function getSeoCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400',
  };
}

export function generatePortalOrganizationSchema(baseUrl?: string): Record<string, unknown> {
  const base = baseUrl || getBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: SITE_CONFIG.name,
    legalName: SITE_CONFIG.institutional.responsible,
    url: base,
    logo: {
      '@type': 'ImageObject',
      url: `${base}/cover.png`,
      width: 1200,
      height: 630,
    },
    sameAs: [
      'https://twitter.com/normajuridica',
      'https://www.facebook.com/normajuridica',
      'https://www.instagram.com/normajuridica',
    ],
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE_CONFIG.institutional.address,
      addressCountry: 'BR',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: SITE_CONFIG.institutional.phone,
      contactType: 'editorial',
      email: SITE_CONFIG.institutional.email,
      availableLanguage: ['Portuguese'],
    },
    masthead: `${base}/pagina/sobre`,
    ethicsPolicy: `${base}/pagina/linha-editorial`,
    correctionsPolicy: `${base}/pagina/linha-editorial`,
  };
}

export function generateWebSiteSchema(baseUrl?: string): Record<string, unknown> {
  const base = baseUrl || getBaseUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.name,
    url: base,
    description: SITE_CONFIG.description,
    inLanguage: 'pt-BR',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function generateNewsArticleSchema(article: NewsItem, baseUrl?: string): Record<string, unknown> {
  const base = baseUrl || getBaseUrl();
  const canonicalUrl = `${base}/noticia/${article.slug}`;
  const images = article.images && article.images.length > 0 ? article.images : [article.imageUrl || `${base}/cover.png`];

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    headline: article.title,
    description: article.summary,
    image: images.map(img => (img.startsWith('http') ? img : `${base}${img}`)),
    datePublished: article.isoDate || article.pubDate,
    dateModified: article.isoDate || article.pubDate,
    author: {
      '@type': 'Person',
      name: article.author || SITE_CONFIG.name,
      jobTitle: 'Redator Jornalístico',
    },
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: SITE_CONFIG.name,
      logo: {
        '@type': 'ImageObject',
        url: `${base}/cover.png`,
      },
    },
    articleSection: article.category,
    inLanguage: 'pt-BR',
  };
}

export function auditPageMetadata(meta: {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
}): { score: number; passed: string[]; suggestions: string[] } {
  let score = 100;
  const passed: string[] = [];
  const suggestions: string[] = [];

  if (!meta.title || meta.title.length < 25) {
    score -= 25;
    suggestions.push('O título da página deve ter ao menos 25 caracteres para SEO ideal.');
  } else {
    passed.push('Título com tamanho adequado e marca.');
  }

  if (!meta.description || meta.description.length < 50) {
    score -= 25;
    suggestions.push('A meta description deve conter entre 120 e 160 caracteres.');
  } else {
    passed.push('Meta description atende aos padrões de busca.');
  }

  if (!meta.canonical) {
    score -= 25;
    suggestions.push('Adicione uma tag canônica explícita.');
  } else {
    passed.push('Tag canonical configurada.');
  }

  if (!meta.ogImage) {
    score -= 25;
    suggestions.push('Adicione uma imagem Open Graph de alta resolução.');
  } else {
    passed.push('Imagem social Open Graph configurada.');
  }

  return { score: Math.max(0, score), passed, suggestions };
}
