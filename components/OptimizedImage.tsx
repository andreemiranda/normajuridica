'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface OptimizedImageProps {
  src?: string;
  fallbackSrc?: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  className?: string;
}

function extractCleanUrl(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw.trim();
  if (str === 'undefined' || str === 'null') return '';

  // If passed an HTML fragment with <img src="..."
  const imgMatch = str.match(/src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) {
    str = imgMatch[1];
  }

  // Restore any accidentally sanitized glbimg URLs
  str = str.replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo');
  return str.trim();
}

export function OptimizedImage({
  src,
  fallbackSrc = '/cover.png',
  alt,
  width,
  height,
  fill,
  priority = false,
  sizes,
  className = '',
}: OptimizedImageProps) {
  const cleanSrc = extractCleanUrl(src);
  const isGazetaEsportiva = cleanSrc.toLowerCase().includes('gazetaesportiva.com');
  const isLocal = cleanSrc.startsWith('/');

  // State machine:
  // 1) Non-Gazeta external: Next.js <Image> -> onError -> direct <img> (original URL) -> onError -> fallbackSrc (/cover.png)
  // 2) Gazeta Esportiva: direct <img> (original URL, NO next_image) -> onError -> fallbackSrc (/cover.png)
  // 3) No cleanSrc: fallbackSrc (/cover.png) as absolute last resort
  const [prevSrc, setPrevSrc] = useState<string>(cleanSrc);
  const [useDirectImg, setUseDirectImg] = useState<boolean>(
    isGazetaEsportiva || isLocal || !cleanSrc
  );
  const [useCoverFallback, setUseCoverFallback] = useState<boolean>(!cleanSrc);

  if (prevSrc !== cleanSrc) {
    setPrevSrc(cleanSrc);
    setUseDirectImg(isGazetaEsportiva || isLocal || !cleanSrc);
    setUseCoverFallback(!cleanSrc);
  }

  const effectiveSrc = useCoverFallback || !cleanSrc ? fallbackSrc : cleanSrc;

  // Render native <img> for gazetaesportiva.com, local paths, direct fallback after next_image block, or last-resort /cover.png
  if (useDirectImg || useCoverFallback || !cleanSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={effectiveSrc}
        alt={alt || 'Norma Jurídica'}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        data-pin-nopin="true"
        data-pin-no-hover="true"
        onError={() => {
          if (!useCoverFallback && effectiveSrc !== fallbackSrc) {
            setUseCoverFallback(true);
          }
        }}
        className={`${fill ? 'absolute inset-0 w-full h-full object-cover' : ''} transition-transform duration-500 ease-out group-hover:scale-105 hover:scale-105 ${className}`}
        style={!fill && (width || height) ? { width: width ? `${width}px` : undefined, height: height ? `${height}px` : undefined } : undefined}
      />
    );
  }

  // Next.js optimized next_image mode with graceful fallback to native direct <img> upon block/error
  return (
    <Image
      src={cleanSrc}
      alt={alt || 'Norma Jurídica'}
      width={!fill ? width || 800 : undefined}
      height={!fill ? height || 450 : undefined}
      fill={fill}
      priority={priority}
      sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
      referrerPolicy="no-referrer"
      data-pin-nopin="true"
      data-pin-no-hover="true"
      onError={() => setUseDirectImg(true)}
      className={`transition-transform duration-500 ease-out group-hover:scale-105 hover:scale-105 ${className}`}
    />
  );
}
