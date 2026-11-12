import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  output: 'standalone',
  env: {
    NEXT_PUBLIC_ADSENSE_ID:
      process.env.NEXT_PUBLIC_ADSENSE_ID ||
      process.env.GOOGLE_ADSENSE_CLIENT_ID ||
      'ca-pub-7059730627018047',
    NEXT_PUBLIC_ADSENSE_SLOT_HEADER:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_HEADER ||
      process.env.GOOGLE_ADSENSE_SLOT_HEADER ||
      '',
    NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR ||
      process.env.GOOGLE_ADSENSE_SLOT_SIDEBAR ||
      '',
    NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR_BOTTOM:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR_BOTTOM ||
      process.env.GOOGLE_ADSENSE_SLOT_SIDEBAR_BOTTOM ||
      '',
    NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE ||
      process.env.GOOGLE_ADSENSE_SLOT_IN_ARTICLE ||
      '',
    NEXT_PUBLIC_ADSENSE_SLOT_FOOTER:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_FOOTER ||
      process.env.GOOGLE_ADSENSE_SLOT_FOOTER ||
      '',
  },
  poweredByHeader: false,
  compress: true,
  outputFileTracingIncludes: {
    '/*': ['./data/**/*'],
  },
  transpilePackages: ['motion'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
      {
        source: '/:file(sitemap.*\\.xml|robots\\.txt|ads\\.txt)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  webpack: (config, {dev}) => {
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
