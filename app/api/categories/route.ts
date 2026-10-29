import { NextResponse } from 'next/server';
import { ALL_CATEGORIES } from '@/lib/sources';
import { sanitizePublicData } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  const categories = ALL_CATEGORIES.map(cat => ({
    ...cat,
    count: cat.id === 'all' ? 120 : cat.highlight ? 45 : 20,
  }));

  return NextResponse.json(
    sanitizePublicData({
      success: true,
      total: categories.length,
      categories,
    }),
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    }
  );
}
