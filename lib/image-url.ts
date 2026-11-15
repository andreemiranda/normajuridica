// lib/image-url.ts
// Pure, runtime-agnostic helpers (Node, Browser, Edge) for restoring natural full-resolution source image URLs.

const WIDTH_PARAM_KEYS = new Set([
  'w',
  'width',
  'mw',
  'maxwidth',
  'minwidth',
  'imwidth',
  'sw',
  'w_px',
]);
const HEIGHT_PARAM_KEYS = new Set([
  'h',
  'height',
  'mh',
  'maxheight',
  'minheight',
  'h_px',
]);
const RESIZE_PARAM_KEYS = new Set(['resize', 'fit', 'crop', 'sz', 'size', 's', 'zoom', 'scale']);
const SIGNED_URL_REGEX =
  /(?:^|[?&])(?:x-amz-[a-z0-9-]+|x-goog-[a-z0-9-]+|signature|expires|sig|sv|se|sp|hmac|checksum|token|auth)=/i;

export function restoreCorruptedMediaDomain(url: string): string {
  return url.replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo');
}

export function isSignedImageUrl(url: string): boolean {
  return SIGNED_URL_REGEX.test(url);
}

export function isLowResThumbnailUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  const qMatch = lower.match(/[?&](?:w|width|mw|maxwidth|imwidth|sw|s|size)=(\d+)\b/);
  if (qMatch && parseInt(qMatch[1], 10) < 600) return true;
  const rMatch = lower.match(/[?&](?:resize|fit)=(\d+)[,x](\d+)\b/);
  if (rMatch && parseInt(rMatch[1], 10) < 600) return true;
  const fileMatch = lower.split('?')[0].match(/-(\d+)x(\d+)\.(?:jpe?g|png|webp|gif|avif)$/i);
  if (fileMatch && parseInt(fileMatch[1], 10) < 600) return true;
  return false;
}

function unwrapNextImageProxy(rawUrl: string): string {
  try {
    if (/\/_next\/image\b/i.test(rawUrl)) {
      const parsed = new URL(rawUrl, 'https://localhost');
      const inner = parsed.searchParams.get('url');
      if (inner && /^https?:\/\//i.test(inner)) {
        return inner;
      }
    }
  } catch {}
  return rawUrl;
}

/**
 * Normalizes an image URL to the natural full resolution of the source,
 * eliminating all width/height/resize/crop query parameters while preserving signed URLs.
 */
export function upgradeImageResolution(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let clean = restoreCorruptedMediaDomain(rawUrl).replace(/&amp;/g, '&').trim();
  if (!clean || clean === 'undefined' || clean === 'null') return '';
  clean = unwrapNextImageProxy(clean);
  if (!/^https?:\/\//i.test(clean)) return clean;

  // Never mutate presigned / tokenized URLs
  if (isSignedImageUrl(clean)) {
    return clean;
  }

  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    return clean;
  }

  let mutated = false;
  let strippedDimensionParam = false;
  const keysToDelete: string[] = [];

  for (const [key, val] of Array.from(parsed.searchParams.entries())) {
    const kLower = key.toLowerCase();
    const vTrim = val.trim();

    if (WIDTH_PARAM_KEYS.has(kLower) || HEIGHT_PARAM_KEYS.has(kLower)) {
      keysToDelete.push(key);
      strippedDimensionParam = true;
      mutated = true;
      continue;
    }

    if (kLower === 'resize' || kLower === 'fit' || kLower === 'crop') {
      keysToDelete.push(key);
      strippedDimensionParam = true;
      mutated = true;
      continue;
    }

    if (kLower === 'sz' && /^(?:w\d+(?:-h\d+)?|\d+)$/i.test(vTrim)) {
      keysToDelete.push(key);
      strippedDimensionParam = true;
      mutated = true;
      continue;
    }

    if (
      (kLower === 's' || kLower === 'size' || kLower === 'zoom' || kLower === 'scale') &&
      (/^\d+$/.test(vTrim) || /^(?:thumb|thumbnail|small|medium)$/i.test(vTrim)) &&
      (/\.(?:jpe?g|png|webp|gif|avif)$/i.test(parsed.pathname) ||
        /(?:wp\.com|wordpress\.com|gravatar\.com|wp-content|uploads|cdn|img)/i.test(parsed.href))
    ) {
      keysToDelete.push(key);
      strippedDimensionParam = true;
      mutated = true;
      continue;
    }

    if (RESIZE_PARAM_KEYS.has(kLower) && /^\d+(?:[,xX]\d+)?$/.test(vTrim)) {
      keysToDelete.push(key);
      strippedDimensionParam = true;
      mutated = true;
    }
  }

  for (const k of keysToDelete) {
    parsed.searchParams.delete(k);
  }

  if (strippedDimensionParam) {
    // Strip quality override if it was tied to a resized thumbnail request
    for (const key of Array.from(parsed.searchParams.keys())) {
      const kLower = key.toLowerCase();
      if (kLower === 'q' || kLower === 'quality' || kLower === 'strip') {
        parsed.searchParams.delete(key);
      }
    }
  }

  // Googleusercontent / Blogger URLs (=w200-h150-c, =s200, /s200/, /w200/) -> s0 (natural source resolution)
  if (/(?:googleusercontent\.com|ggpht\.com|blogspot\.com)/i.test(parsed.hostname)) {
    const newPath = parsed.pathname
      .replace(/\/([sw])(\d+)(?:-[ch][a-z0-9-]*)?\//gi, (m, _prefix, digits) =>
        parseInt(digits, 10) > 0 ? '/s0/' : m
      )
      .replace(/=([sw])(\d+)(?:-[a-z0-9-]+)*$/i, (m, _prefix, digits) =>
        parseInt(digits, 10) > 0 ? '=s0' : m
      );
    if (newPath !== parsed.pathname) {
      parsed.pathname = newPath;
      mutated = true;
    }
  }

  // Strip tiny WordPress thumbnail filename suffixes (width < 500px, e.g. -200x133.jpg, -300x200.webp)
  // while leaving glbimg signed paths and large images (-860x484, -1200x675) untouched
  if (!/glbimg\.com/i.test(parsed.hostname)) {
    const nextPath = parsed.pathname.replace(
      /-(\d{2,3})x(\d{2,3})(\.(?:jpe?g|png|webp|gif|avif))$/i,
      (full, wStr, _hStr, ext) => (parseInt(wStr, 10) < 500 ? ext : full)
    );
    if (nextPath !== parsed.pathname) {
      parsed.pathname = nextPath;
      mutated = true;
    }
  }

  return mutated ? parsed.toString() : clean;
}

export const normalizeNaturalImageUrl = upgradeImageResolution;

export function pickBestImgSrcFromAttrs(attrs: string): string {
  if (!attrs) return '';

  const isUsableUrl = (u: string): boolean => {
    const lower = u.toLowerCase();
    return (
      (lower.startsWith('http://') || lower.startsWith('https://')) &&
      !lower.includes('placeholder') &&
      !lower.includes('data:image') &&
      !lower.includes('blank.gif') &&
      !lower.includes('1x1')
    );
  };

  const candidates: Array<{ url: string; score: number }> = [];

  const srcsetMatch = attrs.match(/\b(?:data-srcset|srcset)=["']([^"']+)["']/i);
  if (srcsetMatch && srcsetMatch[1]) {
    const entries = srcsetMatch[1].split(',');
    for (const entry of entries) {
      const parts = entry.trim().split(/\s+/);
      const raw = parts[0] ? restoreCorruptedMediaDomain(parts[0]).replace(/&amp;/g, '&').trim() : '';
      if (!isUsableUrl(raw)) continue;
      let widthScore = 0;
      const desc = parts[1] || '';
      const wMatch = desc.match(/^(\d+)w$/i);
      const xMatch = desc.match(/^(\d+(?:\.\d+)?)x$/i);
      if (wMatch) widthScore = parseInt(wMatch[1], 10);
      else if (xMatch) widthScore = Math.round(parseFloat(xMatch[1]) * 800);
      candidates.push({ url: upgradeImageResolution(raw), score: widthScore || 500 });
    }
  }

  const attrSources = [
    attrs.match(/\bdata-original=["']([^"']+)["']/i)?.[1],
    attrs.match(/\bdata-lazy-src=["']([^"']+)["']/i)?.[1],
    attrs.match(/\bdata-src=["']([^"']+)["']/i)?.[1],
    attrs.match(/\bsrc=["']([^"']+)["']/i)?.[1],
  ];

  for (const rawSrc of attrSources) {
    if (!rawSrc) continue;
    const raw = restoreCorruptedMediaDomain(rawSrc).replace(/&amp;/g, '&').trim();
    if (!isUsableUrl(raw)) continue;
    const upgraded = upgradeImageResolution(raw);
    const score = isLowResThumbnailUrl(upgraded) ? 200 : 800;
    candidates.push({ url: upgraded, score });
  }

  if (candidates.length === 0) return '';
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url;
}
