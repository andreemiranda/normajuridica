'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Cloud, CloudRain, CloudLightning, Moon, Droplets, Thermometer, ShieldAlert } from 'lucide-react';
import { WeatherInfo } from '@/lib/types';

export function WeatherCard() {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadWeather() {
      try {
        let query = 'Brasilia';

        if (typeof window !== 'undefined' && 'geolocation' in navigator) {
          let geoAllowed = true;
          try {
            const docPolicy = document as unknown as {
              permissionsPolicy?: { allowsFeature?: (feature: string) => boolean };
              featurePolicy?: { allowsFeature?: (feature: string) => boolean };
            };
            const policy = docPolicy.permissionsPolicy || docPolicy.featurePolicy;
            if (policy && typeof policy.allowsFeature === 'function') {
              geoAllowed = policy.allowsFeature('geolocation');
            }
          } catch {}

          if (geoAllowed) {
            try {
              const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
              });
              query = `${pos.coords.latitude},${pos.coords.longitude}`;
            } catch {
              // Geolocation rejected or timed out, falls back to default
            }
          }
        }

        const res = await fetch(`/api/weather?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setWeather(data);
            setLoading(false);
          }
        }
      } catch {
        if (isMounted) setLoading(false);
      }
    }

    loadWeather();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-100 dark:bg-zinc-800/60 animate-pulse rounded-2xl p-4 h-[106px] w-full md:w-80 border border-slate-200 dark:border-zinc-700/60" />
    );
  }

  if (!weather) return null;

  // Background and icon selection
  const condLower = weather.condition.toLowerCase();
  let bgGradient = 'from-blue-600 to-indigo-700'; // Default daytime
  let WeatherIcon = Sun;

  if (condLower.includes('chuva') || condLower.includes('garoa')) {
    bgGradient = 'from-sky-700 to-blue-900';
    WeatherIcon = CloudRain;
  } else if (condLower.includes('tempestade') || condLower.includes('trovoada')) {
    bgGradient = 'from-purple-800 to-indigo-950';
    WeatherIcon = CloudLightning;
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

  return (
    <div
      className={`rounded-2xl p-4 text-white bg-gradient-to-br ${bgGradient} shadow-md flex items-center justify-between gap-4 w-full md:w-84 border border-white/10`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
          <WeatherIcon className="w-8 h-8 text-white drop-shadow" />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black tracking-tight">{weather.temperature}°C</span>
            <span className="text-xs text-white/80 font-medium">{weather.city}</span>
          </div>
          <p className="text-xs text-white/90 font-medium capitalize line-clamp-1">{weather.condition}</p>
        </div>
      </div>

      <div className="text-right text-[11px] text-white/85 space-y-1 font-medium border-l border-white/20 pl-3">
        <div className="flex items-center justify-end gap-1">
          <Thermometer className="w-3 h-3" />
          <span>Sensação {weather.feelsLike}°</span>
        </div>
        <div className="flex items-center justify-end gap-1">
          <Droplets className="w-3 h-3" />
          <span>{weather.humidity}% Umid.</span>
        </div>
        <div className="flex items-center justify-end gap-1">
          <ShieldAlert className="w-3 h-3" />
          <span>UV {weather.uvIndex} ({weather.uvDescription})</span>
        </div>
      </div>
    </div>
  );
}
