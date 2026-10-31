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
  const [imgError, setImgError] = useState(false);

  // Validate source url
  const isValid = (u?: string): boolean => {
    if (!u) return false;
    const lower = u.toLowerCase();
    return (
      !lower.includes('placeholder') &&
      !lower.includes('data:image') &&
      !lower.includes('pixel') &&
      !lower.includes('1x1') &&
      !lower.includes('blank.gif') &&
      !lower.includes('gazetaesportiva.com')
    );
  };

  const finalSrc = (!src || imgError || !isValid(src)) ? '/cover.png' : src;

  return (
    <Image
      src={finalSrc}
      alt={alt || 'Norma Jurídica'}
      width={!fill ? width || 800 : undefined}
      height={!fill ? height || 450 : undefined}
      fill={fill}
      priority={priority}
      sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      className={`transition-transform duration-500 ease-out group-hover:scale-105 hover:scale-105 ${className}`}
    />
  );
}
