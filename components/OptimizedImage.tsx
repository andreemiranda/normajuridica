'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface OptimizedImageProps {
  src?: string;
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
  alt,
  width,
  height,
  fill,
  priority = false,
  sizes,
  className = '',
}: OptimizedImageProps) {
  const [useDirectFallback, setUseDirectFallback] = useState(false);
  const [imgError, setImgError] = useState(false);

  // If there is no image url from the API or failed, don't show artificial fallback images
  if (!src || imgError) {
    return null;
  }

  // Detect gazetaesportiva.com domain or fallback when Next image optimizer fails
  const isGazetaEsportiva = src.toLowerCase().includes('gazetaesportiva.com');

  if (isGazetaEsportiva || useDirectFallback) {
    return (
      // Direct unoptimized image embedding
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || 'Norma Jurídica'}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        data-pin-nopin="true"
        data-pin-no-hover="true"
        suppressHydrationWarning
        onError={() => setImgError(true)}
        className={`${fill ? 'absolute inset-0 w-full h-full object-cover' : ''} transition-transform duration-500 ease-out group-hover:scale-105 hover:scale-105 ${className}`}
        style={!fill && (width || height) ? { width: width ? `${width}px` : undefined, height: height ? `${height}px` : undefined } : undefined}
      />
    );
  }

  // All other sources start with Next.js optimized next_image mode, with auto-fallback to direct <img>
  return (
    <Image
      src={src}
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
      onError={() => setUseDirectFallback(true)}
      className={`transition-transform duration-500 ease-out group-hover:scale-105 hover:scale-105 ${className}`}
    />
  );
}
