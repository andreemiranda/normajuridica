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
  const cleanSrc = (src && typeof src === 'string' && src.trim() && src.trim() !== 'undefined' && src.trim() !== 'null')
    ? src.trim()
    : '';

  const initialSrc = cleanSrc || fallbackSrc;
  const isGazetaEsportiva = initialSrc.toLowerCase().includes('gazetaesportiva.com');
  const isLocal = initialSrc.startsWith('/');

  // Load mode: 'next_image' | 'direct_img' | 'fallback'
  const [loadMode, setLoadMode] = useState<'next_image' | 'direct_img' | 'fallback'>(
    isGazetaEsportiva || isLocal || !cleanSrc ? 'direct_img' : 'next_image'
  );

  const activeSrc = loadMode === 'fallback' ? fallbackSrc : initialSrc;

  // Direct unoptimized image embedding (for gazetaesportiva.com, local assets, fallback, or when Next optimizer fails)
  if (loadMode === 'direct_img' || loadMode === 'fallback') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={activeSrc}
        alt={alt || 'Norma Jurídica'}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        data-pin-nopin="true"
        data-pin-no-hover="true"
        suppressHydrationWarning
        onError={() => {
          if (loadMode !== 'fallback') {
            setLoadMode('fallback');
          }
        }}
        className={`${fill ? 'absolute inset-0 w-full h-full object-cover' : ''} transition-transform duration-500 ease-out group-hover:scale-105 hover:scale-105 ${className}`}
        style={!fill && (width || height) ? { width: width ? `${width}px` : undefined, height: height ? `${height}px` : undefined } : undefined}
      />
    );
  }

  // All other sources start with Next.js optimized next_image mode, with auto-fallback to direct <img> then /cover.png
  return (
    <Image
      src={initialSrc}
      alt={alt || 'Norma Jurídica'}
      width={!fill ? width || 800 : undefined}
      height={!fill ? height || 450 : undefined}
      fill={fill}
      priority={priority}
      sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
      referrerPolicy="no-referrer"
      data-pin-nopin="true"
      data-pin-no-hover="true"
      suppressHydrationWarning
      onError={() => setLoadMode('direct_img')}
      className={`transition-transform duration-500 ease-out group-hover:scale-105 hover:scale-105 ${className}`}
    />
  );
}
