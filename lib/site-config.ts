function cleanDomain(input?: string): string {
  if (!input) return 'normajuridica.com.br';
  let d = input.trim();
  d = d.replace(/^https?:\/\//i, '');
  d = d.replace(/\/.*$/, '');
  d = d.replace(/[^a-zA-Z0-9.-]/g, '');
  if (!d || d.length < 4 || !d.includes('.') || d.includes('localhost')) {
    return 'normajuridica.com.br';
  }
  return d;
}

const domain = cleanDomain(
  process.env.NEXT_PUBLIC_SITE_DOMAIN ||
  process.env.SITE_DOMAIN
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
    email: `contato@${domain}`,
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
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure:
      process.env.SMTP_SECURE === 'true' ||
      (process.env.SMTP_PORT ? process.env.SMTP_PORT === '465' : true),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    receiver:
      process.env.CONTACT_RECEIVER_EMAIL ||
      process.env.SMTP_USER ||
      `contato@${domain}`,
  },
  aiSummary: {
    endpoint: process.env.AI_SUMMARY_API_ENDPOINT || '',
    apiKey: process.env.AI_SUMMARY_API_KEY || '',
    model: process.env.AI_SUMMARY_MODEL || 'gpt-4o-mini',
  },
};

export function getBaseUrl(req?: Request | { headers?: Headers | Record<string, string> }): string {
  // 1. APP_URL
  if (process.env.APP_URL && process.env.APP_URL.trim() && !process.env.APP_URL.includes('MY_APP_URL')) {
    return cleanUrl(process.env.APP_URL);
  }

  // 2. SITE_DOMAIN
  if (process.env.SITE_DOMAIN && process.env.SITE_DOMAIN.trim()) {
    return cleanUrl(process.env.SITE_DOMAIN);
  }

  // 3. NEXT_PUBLIC_SITE_URL
  if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim()) {
    return cleanUrl(process.env.NEXT_PUBLIC_SITE_URL);
  }

  // 4. Request headers (x-forwarded-host / host)
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
      return cleanUrl(host);
    }
  }

  // 5. Vercel deployment variables
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
  return 'https://normajuridica.com.br';
}

function cleanUrl(url: string): string {
  let cleaned = url.trim();
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned.replace(/\/+$/, '');
}
