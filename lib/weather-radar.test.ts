import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_WEATHER_API_BASE_URL,
  clearWeatherRadarCache,
  findNearestCity,
  getWeatherRadarData,
  haversineKm,
  parseCoordinatesQuery,
  resolveWeatherApiConfig,
} from './weather-radar';

test('resolveWeatherApiConfig usa https://radarmeteorologico.com.br sem API key ou senha', () => {
  const def = resolveWeatherApiConfig({});
  assert.equal(def.baseUrl, DEFAULT_WEATHER_API_BASE_URL);
  assert.equal(def.requiresAuth, false);

  const custom = resolveWeatherApiConfig({
    WEATHER_API_BASE_URL: 'https://radarmeteorologico.com.br/',
  });
  assert.equal(custom.baseUrl, 'https://radarmeteorologico.com.br');
  assert.equal(custom.requiresAuth, false);

  // Bloqueia URL insegura/SSRF e retorna padrão seguro
  const unsafe = resolveWeatherApiConfig({
    WEATHER_API_BASE_URL: 'http://127.0.0.1:8080',
  });
  assert.equal(unsafe.baseUrl, DEFAULT_WEATHER_API_BASE_URL);
});

test('parseCoordinatesQuery, haversineKm e findNearestCity resolvem coordenadas com precisão', () => {
  const coords = parseCoordinatesQuery(' -23.5505 , -46.6333 ');
  assert.deepEqual(coords, { lat: -23.5505, lon: -46.6333 });
  assert.equal(parseCoordinatesQuery('999, -46.6'), null);
  assert.equal(parseCoordinatesQuery('São Paulo'), null);

  const distSpRio = haversineKm(-23.5505, -46.6333, -22.9068, -43.1729);
  assert.ok(distSpRio > 340 && distSpRio < 370);

  const nearest = findNearestCity(-23.55, -46.63, [
    { nome: 'Brasília', uf: 'DF', ibge: 5300108, slug: 'brasilia', latitude: -15.78, longitude: -47.93 },
    { nome: 'São Paulo', uf: 'SP', ibge: 3550308, slug: 'sao-paulo', latitude: -23.55, longitude: -46.63 },
  ]);
  assert.equal(nearest?.nome, 'São Paulo');
});

test('getWeatherRadarData consulta /api/v1/cidades, /temperaturas e /alertas sem chave e inclui crédito e alertas INMET', async () => {
  clearWeatherRadarCache();
  const originalFetch = globalThis.fetch;
  const seenUrls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    seenUrls.push(urlStr);
    const headers = new Headers(init?.headers || {});
    assert.equal(headers.has('Authorization'), false);
    assert.equal(headers.has('x-api-key'), false);

    const u = new URL(urlStr);
    if (u.pathname === '/api/v1/cidades' && !u.search) {
      return new Response(
        JSON.stringify({
          cidades: [
            { nome: 'São Paulo', uf: 'SP', ibge: 3550308, slug: 'sao-paulo', latitude: -23.5505, longitude: -46.6333, capital: true },
            { nome: 'Brasília', uf: 'DF', ibge: 5300108, slug: 'brasilia', latitude: -15.7795, longitude: -47.9297, capital: true },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (u.pathname === '/api/v1/cidades' && u.searchParams.get('uf') === 'SP') {
      return new Response(
        JSON.stringify({
          cidades: [
            { nome: 'Campinas', uf: 'SP', ibge: 3509502, slug: 'campinas', latitude: -22.9099, longitude: -47.0626 },
            { nome: 'São Paulo', uf: 'SP', ibge: 3550308, slug: 'sao-paulo', latitude: -23.5505, longitude: -46.6333, capital: true },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (u.pathname === '/api/v1/temperaturas') {
      return new Response(
        JSON.stringify({
          mais_quentes: [
            { cidade: 'Campinas', uf: 'SP', ibge: 3509502, temperatura: 29.4, maxima: 31.8, minima: 19.2, condicao: 'Parcialmente nublado', codigo_wmo: 2, chuva_mm: 0 },
          ],
          mais_frias: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (u.pathname === '/api/v1/alertas') {
      return new Response(
        JSON.stringify({
          alertas: [
            {
              id: 77,
              evento: 'Chuvas Intensas',
              severidade: 'Perigo Potencial',
              nivel: 2,
              inicio: '2026-11-16T10:00:00Z',
              fim: '2026-11-17T10:00:00Z',
              futuro: false,
              municipios_afetados: 14,
              geocodes: [3509502],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;

  try {
    const data = await getWeatherRadarData({ query: '-22.91,-47.06' });
    assert.equal(data.city, 'Campinas');
    assert.equal(data.uf, 'SP');
    assert.equal(data.ibge, 3509502);
    assert.equal(data.temperature, 29);
    assert.equal(data.maxTemp, 32);
    assert.equal(data.minTemp, 19);
    assert.equal(data.attributionName, 'Radar Meteorológico');
    assert.equal(data.attributionUrl, 'https://radarmeteorologico.com.br');
    assert.equal(data.alert?.event, 'Chuvas Intensas');
    assert.equal(data.alert?.cityAffected, true);
    assert.equal(data.isFallback, false);
    assert.ok(seenUrls.some((u) => u.includes('/api/v1/alertas?uf=SP')));
  } finally {
    globalThis.fetch = originalFetch;
    clearWeatherRadarCache();
  }
});
