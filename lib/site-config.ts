function stripWrappingQuotes(input?: string): string {
  if (!input) return '';
  let s = input.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function cleanDomain(input?: string): string {
  const raw = stripWrappingQuotes(input);
  if (!raw || raw.includes('MY_APP_URL')) return 'news.mirandinhacontabilidade.workers.dev';
  let d = raw;
  d = d.replace(/^https?:\/\//i, '');
  d = d.replace(/\/.*$/, '');
  d = d.replace(/:\d+$/, '');
  d = d.replace(/[^a-zA-Z0-9.-]/g, '');
  if (!d || d.length < 4 || !d.includes('.') || d.includes('localhost')) {
    return 'news.mirandinhacontabilidade.workers.dev';
  }
  return d;
}

const domain = cleanDomain(
  process.env.NEXT_PUBLIC_SITE_DOMAIN ||
  process.env.SITE_DOMAIN ||
  process.env.NEXT_PUBLIC_DOMAIN ||
  process.env.DOMAIN ||
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL
);

export const SITE_CONFIG = {
  name: 'Norma Jurídica',
  shortName: 'Norma Jurídica',
  tagline: 'A informação que move o Brasil',
  description:
    'Portal de notícias com cobertura de política, economia, justiça, educação, esportes, tecnologia e notícias dos estados brasileiros.',
  domain,
  institutional: {
    responsible: 'Norma Jurídica',
    address: 'Brasília-DF',
    phone: '(61) 9 9242-8022',
    email: 'contato@normajuridica.com.br',
  },
  adsense: {
    clientId:
      process.env.NEXT_PUBLIC_ADSENSE_ID ||
      process.env.GOOGLE_ADSENSE_CLIENT_ID ||
      'ca-pub-7059730627018047',
    slots: {
      header:
        process.env.NEXT_PUBLIC_ADSENSE_SLOT_HEADER ||
        process.env.GOOGLE_ADSENSE_SLOT_HEADER ||
        '',
      sidebar:
        process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR ||
        process.env.GOOGLE_ADSENSE_SLOT_SIDEBAR ||
        '',
      sidebarBottom:
        process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR_BOTTOM ||
        process.env.GOOGLE_ADSENSE_SLOT_SIDEBAR_BOTTOM ||
        '',
      inArticle:
        process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE ||
        process.env.GOOGLE_ADSENSE_SLOT_IN_ARTICLE ||
        '',
      footer:
        process.env.NEXT_PUBLIC_ADSENSE_SLOT_FOOTER ||
        process.env.GOOGLE_ADSENSE_SLOT_FOOTER ||
        '',
    },
  },
};

export function getBaseUrl(req?: Request | { headers?: Headers | Record<string, string> }): string {
  const urlCandidates = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_URL,
    process.env.SITE_URL,
    process.env.SITE_DOMAIN,
    process.env.NEXT_PUBLIC_SITE_DOMAIN,
    process.env.NEXT_PUBLIC_DOMAIN,
    process.env.NEXT_DOMAIN,
  ];
  for (const cand of urlCandidates) {
    const cleaned = stripWrappingQuotes(cand);
    if (cleaned && !cleaned.includes('MY_APP_URL')) {
      return cleanUrl(cleaned);
    }
  }

  // 4. Request headers (Cloudflare / Proxy x-forwarded-host / host)
  if (req) {
    let host: string | null = null;
    if ('headers' in req && req.headers) {
      if (typeof (req.headers as Headers).get === 'function') {
        const h = req.headers as Headers;
        host = h.get('x-forwarded-host') || h.get('host');
      } else {
        const raw = req.headers as Record<string, string>;
        host = raw['x-forwarded-host'] || raw['host'] || null;
      }
    }
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      const normalizedHost = host.replace(/^www\./i, '');
      return cleanUrl(normalizedHost);
    }
  }

  // 5. Cloudflare / Vercel deployment variables
  if (process.env.CF_PAGES_URL) {
    return cleanUrl(process.env.CF_PAGES_URL);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return cleanUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  }
  if (process.env.VERCEL_URL) {
    return cleanUrl(process.env.VERCEL_URL);
  }

  // 6. Client window location
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return cleanUrl(window.location.origin);
  }

  // 7. Canonical fallback
  return 'https://news.mirandinhacontabilidade.workers.dev';
}

function cleanUrl(url: string): string {
  let cleaned = stripWrappingQuotes(url);
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned.replace(/\/+$/, '');
}
