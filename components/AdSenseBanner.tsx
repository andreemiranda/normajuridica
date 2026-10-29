'use client';

import React, { useEffect, useRef } from 'react';
import { SITE_CONFIG } from '@/lib/site-config';

interface AdSenseBannerProps {
  slot?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal';
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

export function AdSenseBanner({ slot, format = 'auto', className = '' }: AdSenseBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);

  const clientId = SITE_CONFIG.adsense.clientId;
  const effectiveSlot = slot || '';

  useEffect(() => {
    if (!clientId || !effectiveSlot || pushedRef.current) return;

    try {
      if (typeof window !== 'undefined') {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        pushedRef.current = true;
      }
    } catch {
      // AdSense silent push failure handled
    }
  }, [clientId, effectiveSlot]);

  // Without clientId or slot, return 1px non-breaking layout spacer
  if (!clientId || !effectiveSlot) {
    return <div className="h-[1px] w-full" aria-hidden="true" />;
  }

  return (
    <aside className={`my-4 overflow-hidden text-center min-h-[90px] ${className}`} aria-label="Publicidade">
      <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">
        Publicidade
      </div>
      <ins
        ref={adRef}
        className="adsbygoogle block"
        data-ad-client={clientId}
        data-ad-slot={effectiveSlot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
