import { NextRequest, NextResponse } from 'next/server';
import { sanitizePublicData, checkRateLimit, sanitizeInput, getClientIp } from '@/lib/security';
import { getWeatherRadarData } from '@/lib/weather-radar';
import { WeatherInfo } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface WeatherCacheEntry {
  data: WeatherInfo;
  timestamp: number;
}

const weatherCache = new Map<string, WeatherCacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min (respeita janela mínima de alertas INMET)
const MAX_WEATHER_CACHE_SIZE = 150;

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

  if (!rawQuery && latParam && lonParam) {
    rawQuery = `${latParam},${lonParam}`;
  }

  // Fallback automático por cabeçalhos de borda (Cloudflare / Vercel / Netlify) quando não há GPS do dispositivo
  if (!rawQuery) {
    const edgeLat = req.headers.get('x-vercel-ip-latitude') || req.headers.get('cf-iplatitude');
    const edgeLon = req.headers.get('x-vercel-ip-longitude') || req.headers.get('cf-iplongitude');
    const edgeCity = req.headers.get('x-vercel-ip-city') || req.headers.get('cf-ipcity');
    if (edgeLat && edgeLon) {
      rawQuery = `${edgeLat},${edgeLon}`;
    } else if (edgeCity) {
      try {
        rawQuery = decodeURIComponent(edgeCity);
      } catch {
        rawQuery = edgeCity;
      }
    } else {
      rawQuery = 'Brasília';
    }
  }

  const query = sanitizeInput(rawQuery, 60).replace(/[^\p{L}\p{N}\s,.-]/gu, '') || 'Brasília';
  const cleanQuery = query.toLowerCase();

  const cached = weatherCache.get(cleanQuery);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(sanitizePublicData(cached.data), {
      headers: { 'Cache-Control': 'public, max-age=600, s-maxage=600' },
    });
  }

  if (weatherCache.size > MAX_WEATHER_CACHE_SIZE) {
    weatherCache.clear();
  }

  const data = await getWeatherRadarData({ query });
  weatherCache.set(cleanQuery, { data, timestamp: Date.now() });

  return NextResponse.json(sanitizePublicData(data), {
    headers: { 'Cache-Control': 'public, max-age=600, s-maxage=600' },
  });
}
