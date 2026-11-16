// lib/weather-radar.ts
import { WeatherAlertInfo, WeatherInfo } from './types';
import { assertSafeExternalUrl } from './security';

export const DEFAULT_WEATHER_API_BASE_URL = 'https://radarmeteorologico.com.br';

export interface WeatherApiConfig {
  baseUrl: string;
  requiresAuth: boolean;
}

export interface RadarCity {
  nome: string;
  uf: string;
  ibge: number;
  slug: string;
  latitude: number;
  longitude: number;
  capital?: boolean;
  fuso?: string;
  url?: string;
}

interface RadarTemperatureStation {
  cidade: string;
  uf: string;
  ibge: number;
  temperatura: number;
  maxima: number;
  minima: number;
  condicao: string;
  codigo_wmo?: number;
  chuva_mm?: number;
  url?: string;
}

interface RadarAlertRaw {
  id?: number;
  evento?: string;
  severidade?: string;
  nivel?: number;
  inicio?: string;
  fim?: string;
  futuro?: boolean;
  estados?: string[];
  municipios_afetados?: number;
  geocodes?: number[];
}

const TTL_CITIES_MS = 24 * 60 * 60 * 1000; // 24 horas (doc radarmeteorologico)
const TTL_TEMPS_MS = 60 * 60 * 1000; // 1 hora (doc radarmeteorologico)
const TTL_ALERTS_MS = 10 * 60 * 1000; // 10 minutos (doc radarmeteorologico)

const capitalsCache: { data: RadarCity[] | null; expiresAt: number } = { data: null, expiresAt: 0 };
const ufCitiesCache = new Map<string, { data: RadarCity[]; expiresAt: number }>();
const cityQueryCache = new Map<string, { data: RadarCity[]; expiresAt: number }>();
const tempsCache: { data: RadarTemperatureStation[] | null; expiresAt: number } = { data: null, expiresAt: 0 };
const alertsCache = new Map<string, { data: RadarAlertRaw[]; expiresAt: number }>();

export function clearWeatherRadarCache(): void {
  capitalsCache.data = null;
  capitalsCache.expiresAt = 0;
  ufCitiesCache.clear();
  cityQueryCache.clear();
  tempsCache.data = null;
  tempsCache.expiresAt = 0;
  alertsCache.clear();
}

export function resolveWeatherApiConfig(
  env: Record<string, string | undefined> = process.env
): WeatherApiConfig {
  const candidates = [
    env.WEATHER_API_BASE_URL,
    env.WEATHER_BASE_URL,
    env.NEXT_PUBLIC_WEATHER_API_BASE_URL,
    env.api_url_clima_base,
  ];

  for (const raw of candidates) {
    const cleaned = (raw || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
    if (!cleaned) continue;
    const safe = assertSafeExternalUrl(cleaned, { requireHttps: true });
    if (safe) {
      return {
        baseUrl: safe.origin,
        requiresAuth: false,
      };
    }
  }

  return {
    baseUrl: DEFAULT_WEATHER_API_BASE_URL,
    requiresAuth: false,
  };
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findNearestCity(lat: number, lon: number, cities: RadarCity[]): RadarCity | null {
  if (!Array.isArray(cities) || cities.length === 0) return null;
  let best: RadarCity | null = null;
  let bestDist = Infinity;
  for (const c of cities) {
    if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) continue;
    const d = haversineKm(lat, lon, c.latitude, c.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function normalizeCityName(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function parseCoordinatesQuery(query?: string): { lat: number; lon: number } | null {
  if (!query) return null;
  const m = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }
  return { lat, lon };
}

async function fetchRadarJson<T>(url: string, timeoutMs = 4500): Promise<T | null> {
  const safeUrl = assertSafeExternalUrl(url, { requireHttps: true });
  if (!safeUrl) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(safeUrl.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NormaJuridica/1.0 (+https://normajuridica.com.br)',
      },
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getCapitals(baseUrl: string): Promise<RadarCity[]> {
  const now = Date.now();
  if (capitalsCache.data && capitalsCache.expiresAt > now) {
    return capitalsCache.data;
  }
  const json = await fetchRadarJson<{ cidades?: RadarCity[] }>(`${baseUrl}/api/v1/cidades`);
  const list = Array.isArray(json?.cidades) ? json.cidades : [];
  if (list.length > 0) {
    capitalsCache.data = list;
    capitalsCache.expiresAt = now + TTL_CITIES_MS;
  }
  return list;
}

async function getCitiesByUf(baseUrl: string, uf: string): Promise<RadarCity[]> {
  const code = (uf || '').toUpperCase().trim();
  if (!code) return [];
  const now = Date.now();
  const cached = ufCitiesCache.get(code);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const json = await fetchRadarJson<{ cidades?: RadarCity[] }>(
    `${baseUrl}/api/v1/cidades?uf=${encodeURIComponent(code)}`
  );
  const list = Array.isArray(json?.cidades) ? json.cidades : [];
  if (list.length > 0) {
    if (ufCitiesCache.size > 40) ufCitiesCache.clear();
    ufCitiesCache.set(code, { data: list, expiresAt: now + TTL_CITIES_MS });
  }
  return list;
}

async function searchCities(baseUrl: string, q: string): Promise<RadarCity[]> {
  const key = normalizeCityName(q);
  if (!key) return [];
  const now = Date.now();
  const cached = cityQueryCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const json = await fetchRadarJson<{ cidades?: RadarCity[] }>(
    `${baseUrl}/api/v1/cidades?q=${encodeURIComponent(q.trim())}`
  );
  const list = Array.isArray(json?.cidades) ? json.cidades : [];
  if (cityQueryCache.size > 150) cityQueryCache.clear();
  cityQueryCache.set(key, { data: list, expiresAt: now + TTL_CITIES_MS });
  return list;
}

async function getMonitoredTemperatures(baseUrl: string): Promise<RadarTemperatureStation[]> {
  const now = Date.now();
  if (tempsCache.data && tempsCache.expiresAt > now) {
    return tempsCache.data;
  }
  const json = await fetchRadarJson<{
    mais_quentes?: RadarTemperatureStation[];
    mais_frias?: RadarTemperatureStation[];
  }>(`${baseUrl}/api/v1/temperaturas?limite=50`);

  const merged: RadarTemperatureStation[] = [];
  const seen = new Set<number>();
  for (const st of [...(json?.mais_quentes || []), ...(json?.mais_frias || [])]) {
    if (!st || typeof st.temperatura !== 'number') continue;
    const key = st.ibge || Math.random();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(st);
    }
  }
  if (merged.length > 0) {
    tempsCache.data = merged;
    tempsCache.expiresAt = now + TTL_TEMPS_MS;
  }
  return merged;
}

async function getAlertsByUf(baseUrl: string, uf: string): Promise<RadarAlertRaw[]> {
  const code = (uf || '').toUpperCase().trim();
  if (!code) return [];
  const now = Date.now();
  const cached = alertsCache.get(code);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const json = await fetchRadarJson<{ alertas?: RadarAlertRaw[] }>(
    `${baseUrl}/api/v1/alertas?uf=${encodeURIComponent(code)}`
  );
  const list = Array.isArray(json?.alertas) ? json.alertas : [];
  if (alertsCache.size > 40) alertsCache.clear();
  alertsCache.set(code, { data: list, expiresAt: now + TTL_ALERTS_MS });
  return list;
}

function estimateHumidityAndUv(condition: string, rainMm = 0, wmo = 0): {
  humidity: number;
  uvIndex: number;
  uvDescription: string;
} {
  const lower = (condition || '').toLowerCase();
  let humidity = 62;
  let uvIndex = 5;

  if (rainMm > 1 || lower.includes('trovoada') || lower.includes('tempestade') || wmo >= 80) {
    humidity = 88;
    uvIndex = 2;
  } else if (rainMm > 0 || lower.includes('chuva') || lower.includes('garoa') || (wmo >= 51 && wmo <= 67)) {
    humidity = 82;
    uvIndex = 3;
  } else if (lower.includes('nublado') || lower.includes('encoberto') || wmo === 3) {
    humidity = 70;
    uvIndex = 4;
  } else if (lower.includes('parcial') || wmo === 2) {
    humidity = 60;
    uvIndex = 6;
  } else if (lower.includes('limpo') || lower.includes('sol') || wmo === 0 || wmo === 1) {
    humidity = 52;
    uvIndex = 8;
  }

  let uvDescription = 'Moderado';
  if (uvIndex >= 8) uvDescription = 'Muito Alto';
  else if (uvIndex >= 6) uvDescription = 'Alto';
  else if (uvIndex <= 2) uvDescription = 'Baixo';

  return { humidity, uvIndex, uvDescription };
}

function selectRelevantAlert(alerts: RadarAlertRaw[], ibge?: number): WeatherAlertInfo | null {
  if (!Array.isArray(alerts) || alerts.length === 0) return null;
  const active = alerts.filter((a) => !a.futuro);
  const pool = active.length > 0 ? active : alerts;

  const matchingCity = ibge
    ? pool.find((a) => Array.isArray(a.geocodes) && a.geocodes.includes(ibge))
    : undefined;

  const chosen =
    matchingCity ||
    [...pool].sort((a, b) => (b.nivel || 0) - (a.nivel || 0))[0];

  if (!chosen || !chosen.evento) return null;
  return {
    event: chosen.evento,
    severity: chosen.severidade || 'Atenção',
    level: Number(chosen.nivel || 1),
    start: chosen.inicio || '',
    end: chosen.fim || '',
    cityAffected: Boolean(matchingCity),
    affectedCount: chosen.municipios_afetados,
  };
}

export async function getWeatherRadarData(options: {
  query?: string;
  env?: Record<string, string | undefined>;
} = {}): Promise<WeatherInfo> {
  const { baseUrl } = resolveWeatherApiConfig(options.env);
  const rawQuery = (options.query || 'Brasília').trim();
  const coords = parseCoordinatesQuery(rawQuery);

  let resolvedCity: RadarCity | null = null;
  const capitals = await getCapitals(baseUrl);

  if (coords) {
    const nearestCap = findNearestCity(coords.lat, coords.lon, capitals);
    if (nearestCap) {
      const ufCities = await getCitiesByUf(baseUrl, nearestCap.uf);
      resolvedCity = findNearestCity(coords.lat, coords.lon, ufCities) || nearestCap;
    }
  } else {
    const normQ = normalizeCityName(rawQuery);
    const matches = await searchCities(baseUrl, rawQuery);
    if (matches.length > 0) {
      resolvedCity =
        matches.find((c) => c.capital && normalizeCityName(c.nome) === normQ) ||
        matches.find((c) => normalizeCityName(c.nome) === normQ) ||
        matches[0];
    } else {
      resolvedCity =
        capitals.find((c) => normalizeCityName(c.nome) === normQ) ||
        capitals.find((c) => normalizeCityName(c.nome).includes(normQ)) ||
        capitals.find((c) => c.uf === 'DF') ||
        null;
    }
  }

  if (!resolvedCity) {
    resolvedCity = {
      nome: 'Brasília',
      uf: 'DF',
      ibge: 5300108,
      slug: 'brasilia',
      latitude: -15.7795,
      longitude: -47.9297,
      capital: true,
    };
  }

  const [stations, alerts, ufCities] = await Promise.all([
    getMonitoredTemperatures(baseUrl),
    getAlertsByUf(baseUrl, resolvedCity.uf),
    getCitiesByUf(baseUrl, resolvedCity.uf),
  ]);

  let matchedStation =
    stations.find((s) => s.ibge === resolvedCity!.ibge) ||
    stations.find(
      (s) =>
        s.uf === resolvedCity!.uf &&
        normalizeCityName(s.cidade) === normalizeCityName(resolvedCity!.nome)
    ) ||
    null;

  if (!matchedStation && stations.length > 0) {
    const cityByIbge = new Map<number, RadarCity>();
    for (const c of ufCities) cityByIbge.set(c.ibge, c);
    for (const c of capitals) cityByIbge.set(c.ibge, c);

    const sameUfStations = stations.filter((s) => s.uf === resolvedCity!.uf);
    const candidatePool = sameUfStations.length > 0 ? sameUfStations : stations;

    let bestDist = Infinity;
    for (const st of candidatePool) {
      const coordCity = cityByIbge.get(st.ibge);
      if (coordCity) {
        const d = haversineKm(
          resolvedCity.latitude,
          resolvedCity.longitude,
          coordCity.latitude,
          coordCity.longitude
        );
        if (d < bestDist) {
          bestDist = d;
          matchedStation = st;
        }
      }
    }

    if (!matchedStation) {
      matchedStation = sameUfStations[0] || stations[0];
    }
  }

  const activeAlert = selectRelevantAlert(alerts, resolvedCity.ibge);

  if (matchedStation) {
    const temp = Math.round(matchedStation.temperatura);
    const maxTemp = Math.round(matchedStation.maxima ?? temp + 3);
    const minTemp = Math.round(matchedStation.minima ?? temp - 4);
    const rainMm = typeof matchedStation.chuva_mm === 'number' ? matchedStation.chuva_mm : 0;
    const condition = matchedStation.condicao || 'Parcialmente nublado';
    const { humidity, uvIndex, uvDescription } = estimateHumidityAndUv(
      condition,
      rainMm,
      matchedStation.codigo_wmo || 0
    );

    return {
      city: resolvedCity.nome,
      uf: resolvedCity.uf,
      ibge: resolvedCity.ibge,
      stationCity:
        matchedStation.ibge !== resolvedCity.ibge && matchedStation.cidade !== resolvedCity.nome
          ? matchedStation.cidade
          : undefined,
      temperature: temp,
      feelsLike: temp + (rainMm > 0 ? 0 : 1),
      humidity,
      condition,
      conditionCode: String(matchedStation.codigo_wmo ?? '0'),
      uvIndex,
      uvDescription,
      maxTemp,
      minTemp,
      rainMm,
      alert: activeAlert,
      attributionName: 'Radar Meteorológico',
      attributionUrl: baseUrl,
      forecast: [
        {
          date: 'Hoje',
          maxTemp,
          minTemp,
          condition,
        },
      ],
      isFallback: false,
    };
  }

  return {
    city: resolvedCity.nome,
    uf: resolvedCity.uf,
    ibge: resolvedCity.ibge,
    temperature: 26,
    feelsLike: 27,
    humidity: 58,
    condition: 'Parcialmente nublado',
    conditionCode: '2',
    uvIndex: 6,
    uvDescription: 'Alto',
    maxTemp: 29,
    minTemp: 19,
    rainMm: 0,
    alert: activeAlert,
    attributionName: 'Radar Meteorológico',
    attributionUrl: baseUrl,
    forecast: [
      {
        date: 'Hoje',
        maxTemp: 29,
        minTemp: 19,
        condition: 'Parcialmente nublado',
      },
    ],
    isFallback: true,
  };
}
