'use client';

import React, { useEffect, useState } from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Moon,
  Droplets,
  Thermometer,
  AlertTriangle,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { WeatherInfo } from '@/lib/types';

export function WeatherCard() {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchWeatherForQuery(query?: string) {
      try {
        const url = query ? `/api/weather?q=${encodeURIComponent(query)}` : '/api/weather';
        const res = await fetch(url);
        if (res.ok && isMounted) {
          const data = await res.json();
          setWeather(data);
          setLoading(false);
        }
      } catch {
        if (isMounted) setLoading(false);
      }
    }

    async function loadWeather() {
      let query: string | undefined;

      try {
        const cachedCoords = window.sessionStorage.getItem('nj_weather_coords');
        if (cachedCoords && /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(cachedCoords)) {
          query = cachedCoords;
        }
      } catch {}

      // Exibe imediatamente a previsão via cache de sessão ou geolocalização de borda/IP (sem esperar timeout do GPS)
      const initialFetch = fetchWeatherForQuery(query);

      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 600000,
              enableHighAccuracy: false,
            });
          });
          const liveCoords = `${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}`;
          if (liveCoords !== query) {
            query = liveCoords;
            try {
              window.sessionStorage.setItem('nj_weather_coords', liveCoords);
            } catch {}
            await fetchWeatherForQuery(liveCoords);
          }
        } catch {
          // Geolocation denied, unavailable, or timed out — initial edge/IP response remains displayed
        }
      }

      await initialFetch;
    }

    loadWeather();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-100 dark:bg-zinc-800/60 animate-pulse rounded-2xl p-4 h-[116px] w-full md:w-96 border border-slate-200 dark:border-zinc-700/60" />
    );
  }

  if (!weather) return null;

  const condLower = weather.condition.toLowerCase();
  let bgGradient = 'from-blue-600 to-indigo-700';
  let WeatherIcon = Sun;

  if (condLower.includes('tempestade') || condLower.includes('trovoada')) {
    bgGradient = 'from-purple-800 to-indigo-950';
    WeatherIcon = CloudLightning;
  } else if (condLower.includes('chuva') || condLower.includes('garoa')) {
    bgGradient = 'from-sky-700 to-blue-900';
    WeatherIcon = CloudRain;
  } else if (condLower.includes('nublado') || condLower.includes('encoberto')) {
    bgGradient = 'from-slate-600 to-slate-800';
    WeatherIcon = Cloud;
  } else if (condLower.includes('noite') || condLower.includes('limpo')) {
    const hour = new Date().getHours();
    if (hour < 6 || hour >= 18) {
      bgGradient = 'from-indigo-900 to-zinc-950';
      WeatherIcon = Moon;
    } else {
      bgGradient = 'from-amber-500 to-orange-600';
      WeatherIcon = Sun;
    }
  } else if (condLower.includes('sol') || condLower.includes('ensolarado')) {
    bgGradient = 'from-amber-500 to-orange-600';
    WeatherIcon = Sun;
  }

  const maxT = weather.maxTemp ?? weather.forecast?.[0]?.maxTemp ?? weather.temperature + 3;
  const minT = weather.minTemp ?? weather.forecast?.[0]?.minTemp ?? weather.temperature - 4;
  const cityLabel = weather.uf ? `${weather.city} • ${weather.uf}` : weather.city;
  const attributionUrl = weather.attributionUrl || 'https://radarmeteorologico.com.br';

  return (
    <div
      data-testid="weather-card"
      className={`rounded-2xl p-4 text-white bg-gradient-to-br ${bgGradient} shadow-md w-full md:w-[23rem] border border-white/10 space-y-2`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl flex-shrink-0">
            <WeatherIcon className="w-7 h-7 text-white drop-shadow" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-3xl font-black tracking-tight">{weather.temperature}°C</span>
              <span className="text-xs text-white/90 font-semibold inline-flex items-center gap-0.5 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {cityLabel}
              </span>
            </div>
            <p className="text-xs text-white/90 font-medium capitalize line-clamp-1">{weather.condition}</p>
          </div>
        </div>

        <div className="text-right text-[11px] text-white/90 space-y-1 font-medium border-l border-white/20 pl-3 flex-shrink-0">
          <div className="flex items-center justify-end gap-1">
            <Thermometer className="w-3 h-3" />
            <span>
              {minT}° / {maxT}°
            </span>
          </div>
          <div className="flex items-center justify-end gap-1">
            <Droplets className="w-3 h-3" />
            <span>
              {typeof weather.rainMm === 'number' && weather.rainMm > 0
                ? `${weather.rainMm} mm`
                : `${weather.humidity}% Umid.`}
            </span>
          </div>
        </div>
      </div>

      {weather.alert && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/25 border border-amber-300/40 text-[11px] font-semibold text-amber-50"
          title={`INMET: ${weather.alert.event} (${weather.alert.severity})`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-200 flex-shrink-0" />
          <span className="truncate">
            INMET: {weather.alert.event} • {weather.alert.severity}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-white/75 pt-0.5 border-t border-white/10">
        <span>
          {weather.stationCity ? `Estação: ${weather.stationCity}` : 'Clima & Alertas INMET'}
        </span>
        <a
          href={attributionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-white/90 hover:text-white underline decoration-white/40"
        >
          <span>radarmeteorologico.com.br</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}
