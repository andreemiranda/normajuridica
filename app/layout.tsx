import type { Metadata, Viewport } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { SITE_CONFIG, getBaseUrl } from '@/lib/site-config';
import { getNewsApiConfig } from '@/lib/api-config';
import { generatePortalOrganizationSchema, generateWebSiteSchema } from '@/lib/seo';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  weight: ['400', '600', '700'],
});

const baseUrl = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: `${SITE_CONFIG.name} | ${SITE_CONFIG.tagline}`,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  applicationName: SITE_CONFIG.name,
  authors: [{ name: SITE_CONFIG.name, url: baseUrl }],
  generator: 'Next.js',
  keywords: [
    'Norma Jurídica',
    'Notícias Brasil',
    'Política',
    'Economia',
    'Justiça',
    'Educação',
    'Esporte',
    'Tecnologia',
    'Jornalismo',
    'Tribunais',
    'Legislação',
  ],
  creator: SITE_CONFIG.name,
  publisher: SITE_CONFIG.name,
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: baseUrl,
  },
  openGraph: {
    title: `${SITE_CONFIG.name} | ${SITE_CONFIG.tagline}`,
    description: SITE_CONFIG.description,
    url: baseUrl,
    siteName: SITE_CONFIG.name,
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_CONFIG.name} - ${SITE_CONFIG.tagline}`,
      },
      {
        url: `${baseUrl}/cover.png`,
        width: 1200,
        height: 630,
        alt: `${SITE_CONFIG.name} - ${SITE_CONFIG.tagline}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_CONFIG.name} | ${SITE_CONFIG.tagline}`,
    description: SITE_CONFIG.description,
    images: [`${baseUrl}/og-image.png`, `${baseUrl}/cover.png`],
    creator: '@normajuridica',
  },
  other: {
    pinterest: 'nopin',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#1d4ed8',
  maximumScale: 5,
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const orgSchema = generatePortalOrganizationSchema(baseUrl);
  const webSiteSchema = generateWebSiteSchema(baseUrl);
  const adsenseClientId = SITE_CONFIG.adsense.clientId;
  const newsApiOrigin = (() => {
    try {
      return new URL(getNewsApiConfig().baseUrl).origin;
    } catch {
      return 'https://news-sources-api.legislativemunicipal.workers.dev';
    }
  })();

  return (
    <html lang="pt-BR" className={`${inter.variable} ${sourceSerif.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Instruction for browser extensions (Pinterest, etc.) to not inject hover buttons or mutate DOM */}
        <meta name="pinterest" content="nopin" />
        <meta name="pinterest" content="nohover" />

        {/* DNS-prefetch & preconnect para Fontes de Notícias e CDNs de Imagens */}
        <link rel="dns-prefetch" href={newsApiOrigin} />
        <link rel="dns-prefetch" href="https://s2-g1.glbimg.com" />
        <link rel="dns-prefetch" href="https://i.s3.glbimg.com" />
        <link rel="dns-prefetch" href="https://gazetaesportiva.com" />
        <link rel="dns-prefetch" href="https://www.gazetaesportiva.com" />
        <link rel="dns-prefetch" href="https://g1.globo.com" />
        <link rel="dns-prefetch" href={baseUrl} />

        <link rel="preconnect" href={newsApiOrigin} crossOrigin="anonymous" />
        <link rel="preconnect" href="https://s2-g1.glbimg.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://i.s3.glbimg.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://gazetaesportiva.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.gazetaesportiva.com" crossOrigin="anonymous" />
        {adsenseClientId && (
          <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />
        )}

        {/* Structured Data: Organization & WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
        />

        {/* Client-side Theme & Font initializer prior to hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var sessionTheme = sessionStorage.getItem('nj_theme_session');
                  var localTheme = localStorage.getItem('nj_theme');
                  var theme = sessionTheme || localTheme;
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  var fontSize = localStorage.getItem('nj_font_size');
                  if (fontSize) {
                    document.documentElement.setAttribute('data-font-size', fontSize);
                  }
                } catch(e) {}
              })();
            `,
          }}
        />

        {/* ChunkLoadError resilience script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                if (/Loading chunk .* failed/i.test(e.message) || /ChunkLoadError/i.test(e.name)) {
                  var now = Date.now();
                  var lastReload = parseInt(sessionStorage.getItem('nj_last_chunk_reload') || '0', 10);
                  if (now - lastReload > 8000) {
                    sessionStorage.setItem('nj_last_chunk_reload', String(now));
                    window.location.reload();
                  }
                }
              });
            `,
          }}
        />

        {/* Google AdSense Script (only rendered if clientId is configured) */}
        {adsenseClientId && (
          <Script
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
      </head>

      <body className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 min-h-screen flex flex-col font-sans transition-colors duration-200">
        {/* Skip to Content Link for Accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-brand-700 focus:text-white focus:rounded-xl focus:shadow-lg focus:outline-none ring-2 ring-brand-300"
        >
          Pular para o conteúdo principal
        </a>

        {children}

        {/* LGPD Cookie Consent Banner */}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
