import { NextResponse } from 'next/server';
import { getNewsStore } from '@/lib/news-store';
import { ALL_CATEGORIES } from '@/lib/sources';
import { sanitizePublicData } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  let categories = ALL_CATEGORIES;
  let counts: Record<string, number> = {};

  try {
    const store = getNewsStore();
    await store.init();
    const [dynamicCats, catCounts] = await Promise.all([
      store.getDynamicCategories(),
      store.getCategoryCounts(),
    ]);
    if (dynamicCats.length > 0) {
      categories = dynamicCats;
    }
    counts = catCounts;
  } catch {}

  const enriched = categories.map(cat => ({
    ...cat,
    count: counts[cat.slug.toLowerCase()] ?? counts[cat.id.toLowerCase()] ?? 0,
  }));

  return NextResponse.json(
    sanitizePublicData({
      success: true,
      total: enriched.length,
      categories: enriched,
    }),
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    }
  );
}
