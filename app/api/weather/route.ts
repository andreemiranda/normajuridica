import { NextRequest, NextResponse } from 'next/server';
import { sanitizePublicData, checkRateLimit, sanitizeInput, getClientIp } from '@/lib/security';
import { getWeatherRadarData, resolveEdgeWeatherQuery } from '@/lib/weather-radar';
import { WeatherInfo } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface WeatherCacheEntry {
  data: WeatherInfo;
  timestamp: number;
}

const weatherCache = new Map<string, WeatherCacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min (respeita janela mínima de alertas INMET)
const MAX_WEATHER_CACHE_SIZE = 150;
const EDGE_GEO_VARY =
  'cf-iplatitude, cf-iplongitude, cf-ipcity, cf-region-code, cf-ipcountry, x-vercel-ip-latitude, x-vercel-ip-longitude, x-vercel-ip-city, x-vercel-ip-country-region, x-vercel-ip-country';

export async function GET(req: NextRequest) {
  const clientIp = getClientIp(req.headers);
  const rateLimit = checkRateLimit(`weather:${clientIp}`, 60, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      sanitizePublicData({ error: 'Muitas consultas de previsão do tempo. Tente novamente em instantes.' }),
      { status: 429 }
    );
  }

  const latParam = req.nextUrl.searchParams.get('lat');
  const lonParam = req.nextUrl.searchParams.get('lon');
  let rawQuery = req.nextUrl.searchParams.get('q') || '';
  const hasExplicitLocation = Boolean(rawQuery.trim() || (latParam && lonParam));

  if (!rawQuery && latParam && lonParam) {
    rawQuery = `${latParam},${lonParam}`;
  }

  // Fallback automático por cabeçalhos de borda (Cloudflare / Vercel / UF) quando não há GPS do dispositivo
  if (!rawQuery) {
    rawQuery = resolveEdgeWeatherQuery(req.headers) || 'Brasília';
  }

  const query = sanitizeInput(rawQuery, 60).replace(/[^\p{L}\p{N}\s,.-]/gu, '') || 'Brasília';
  const cleanQuery = query.toLowerCase();

  const responseHeaders: Record<string, string> = hasExplicitLocation
    ? { 'Cache-Control': 'public, max-age=600, s-maxage=600' }
    : {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        Vary: EDGE_GEO_VARY,
      };

  const cached = weatherCache.get(cleanQuery);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(sanitizePublicData(cached.data), {
      headers: responseHeaders,
    });
  }

  if (weatherCache.size > MAX_WEATHER_CACHE_SIZE) {
    weatherCache.clear();
  }

  const data = await getWeatherRadarData({ query });
  weatherCache.set(cleanQuery, { data, timestamp: Date.now() });

  return NextResponse.json(sanitizePublicData(data), {
    headers: responseHeaders,
  });
}
