import { NextResponse } from 'next/server';
import { sanitizePublicData } from '@/lib/security';
import { SITE_CONFIG } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const memoryUsage =
    typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage()
      : { rss: 0 };
  const uptime =
    typeof process !== 'undefined' && typeof process.uptime === 'function'
      ? Math.floor(process.uptime())
      : 0;

  let platform = 'dedicated-node';
  if (process.env.CLOUDFLARE_WORKER || (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers')) {
    platform = 'cloudflare-worker';
  } else if (process.env.CF_PAGES) {
    platform = 'cloudflare-pages';
  } else if (process.env.VERCEL) {
    platform = 'vercel-serverless';
  } else if (process.env.NETLIFY) {
    platform = 'netlify-serverless';
  } else if (process.env.DOCKER_BUILD || process.env.CONTAINER) {
    platform = 'docker-node';
  }

  const healthData = {
    status: 'healthy',
    app: SITE_CONFIG.name,
    domain: SITE_CONFIG.domain,
    timestamp: new Date().toISOString(),
    uptimeSeconds: uptime,
    memoryRssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
    environment: process.env.NODE_ENV || 'production',
    platform,
  };

  return NextResponse.json(sanitizePublicData(healthData), {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
