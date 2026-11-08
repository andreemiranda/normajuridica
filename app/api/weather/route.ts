import { NextRequest, NextResponse } from 'next/server';
import { sanitizePublicData, checkRateLimit } from '@/lib/security';
import { WeatherInfo } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface WeatherCacheEntry {
  data: WeatherInfo;
  timestamp: number;
}

const weatherCache = new Map<string, WeatherCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const MAX_WEATHER_CACHE_SIZE = 100;

export async function GET(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'anonymous';
  const rateLimit = checkRateLimit(`weather:${clientIp}`, 60, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      sanitizePublicData({ error: 'Muitas consultas de previsão do tempo. Tente novamente em instantes.' }),
      { status: 429 }
    );
  }

  const query = req.nextUrl.searchParams.get('q') || 'Brasilia';
  const cleanQuery = query.trim().toLowerCase().slice(0, 50);

  const cached = weatherCache.get(cleanQuery);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(sanitizePublicData(cached.data));
  }

  if (weatherCache.size > MAX_WEATHER_CACHE_SIZE) {
    weatherCache.clear();
  }

  const apiKey =
    process.env.WEATHER_API_KEY ||
    process.env.api_key_clima ||
    '';

  const baseUrl =
    process.env.WEATHER_API_BASE_URL ||
    process.env.api_url_clima_base ||
    'https://api.weatherapi.com/v1';

  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const url = `${baseUrl.replace(/\/+$/, '')}/forecast.json?key=${apiKey}&q=${encodeURIComponent(query)}&days=1&lang=pt`;
      const res = await fetch(url, { signal: controller.signal, next: { revalidate: 300 } });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        const current = json.current;
        const location = json.location;
        const dayForecast = json.forecast?.forecastday?.[0]?.day;

        const uv = current.uv || 0;
        let uvDesc = 'Baixo';
        if (uv >= 8) uvDesc = 'Muito Alto';
        else if (uv >= 6) uvDesc = 'Alto';
        else if (uv >= 3) uvDesc = 'Moderado';

        const data: WeatherInfo = {
          city: location.name || query,
          temperature: Math.round(current.temp_c),
          feelsLike: Math.round(current.feelslike_c),
          humidity: current.humidity,
          condition: current.condition?.text || 'Parcialmente Nublado',
          conditionCode: String(current.condition?.code || '1000'),
          uvIndex: uv,
          uvDescription: uvDesc,
          forecast: [
            {
              date: 'Hoje',
              maxTemp: Math.round(dayForecast?.maxtemp_c ?? current.temp_c + 3),
              minTemp: Math.round(dayForecast?.mintemp_c ?? current.temp_c - 4),
              condition: dayForecast?.condition?.text || current.condition?.text || 'Estável',
            },
          ],
          isFallback: false,
        };

        weatherCache.set(cleanQuery, { data, timestamp: Date.now() });
        return NextResponse.json(sanitizePublicData(data));
      }
    } catch {}
  }

  // Fallback payload (standard Brasília weather)
  const defaultWeather: WeatherInfo = {
    city: 'Brasília',
    temperature: 26,
    feelsLike: 27,
    humidity: 58,
    condition: 'Ensolarado',
    conditionCode: '1000',
    uvIndex: 7,
    uvDescription: 'Alto',
    forecast: [
      {
        date: 'Hoje',
        maxTemp: 29,
        minTemp: 18,
        condition: 'Sol com poucas nuvens',
      },
    ],
    isFallback: true,
  };

  return NextResponse.json(sanitizePublicData(defaultWeather));
}
