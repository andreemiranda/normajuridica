import { NextResponse } from 'next/server';
import { sanitizePublicData } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  const memoryUsage = process.memoryUsage();
  const uptime = Math.floor(process.uptime());

  let platform = 'dedicated-node';
  if (process.env.VERCEL) platform = 'vercel-serverless';
  else if (process.env.NETLIFY) platform = 'netlify-serverless';

  const healthData = {
    status: 'healthy',
    app: 'Norma Jurídica',
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
