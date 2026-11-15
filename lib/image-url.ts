// lib/image-url.ts
// Pure, runtime-agnostic helpers (Node, Browser, Edge) for upgrading low-resolution image URLs.

const WIDTH_PARAM_KEYS = new Set(['w', 'width', 'mw', 'maxwidth', 'imwidth', 'sw']);
const HEIGHT_PARAM_KEYS = new Set(['h', 'height', 'mh', 'maxheight']);
const PAIR_RESIZE_KEYS = new Set(['resize', 'fit']);
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
  // Query parameter resize below 600px
  const qMatch = lower.match(/[?&](?:w|width|mw|maxwidth|imwidth|sw|s|size)=(\d+)\b/);
  if (qMatch && parseInt(qMatch[1], 10) < 600) return true;
  const rMatch = lower.match(/[?&](?:resize|fit)=(\d+)[,x](\d+)\b/);
  if (rMatch && parseInt(rMatch[1], 10) < 600) return true;
  // Filename dimension suffix like -200x133.jpg or -300x200.webp
  const fileMatch = lower.split('?')[0].match(/-(\d+)x(\d+)\.(?:jpe?g|png|webp|gif|avif)$/i);
  if (fileMatch && parseInt(fileMatch[1], 10) < 600) return true;
  return false;
}

export function upgradeImageResolution(rawUrl?: string, idealWidth = 1200): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let clean = restoreCorruptedMediaDomain(rawUrl).replace(/&amp;/g, '&').trim();
  if (!clean || clean === 'undefined' || clean === 'null') return '';
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

  const targetWidthStr = String(Math.max(800, idealWidth));
  let mutated = false;
  let upgradedWidth = false;

  const entries = Array.from(parsed.searchParams.entries());
  const keysToDelete: string[] = [];

  for (const [key, val] of entries) {
    const kLower = key.toLowerCase();
    const vTrim = val.trim();

    if (WIDTH_PARAM_KEYS.has(kLower)) {
      if (/^\d+$/.test(vTrim)) {
        const num = parseInt(vTrim, 10);
        if (num > 0 && num < 800) {
          parsed.searchParams.set(key, targetWidthStr);
          upgradedWidth = true;
          mutated = true;
        }
      }
      continue;
    }

    if (PAIR_RESIZE_KEYS.has(kLower)) {
      const m = vTrim.match(/^(\d+)\s*[,xX]\s*(\d+)$/);
      if (m) {
        const rw = parseInt(m[1], 10);
        const rh = parseInt(m[2], 10);
        if ((rw > 0 && rw < 800) || (rh > 0 && rh < 500)) {
          keysToDelete.push(key);
          upgradedWidth = true;
          mutated = true;
        }
      }
      continue;
    }

    if (kLower === 'sz') {
      const m = vTrim.match(/^w(\d+)(?:-h(\d+))?/i);
      if (m && parseInt(m[1], 10) < 800) {
        parsed.searchParams.set(key, `w${targetWidthStr}`);
        upgradedWidth = true;
        mutated = true;
      }
      continue;
    }

    if (
      (kLower === 's' || kLower === 'size') &&
      /^\d+$/.test(vTrim) &&
      /\.(?:jpe?g|png|webp|gif|avif)$/i.test(parsed.pathname)
    ) {
      const num = parseInt(vTrim, 10);
      if (num > 0 && num < 800) {
        parsed.searchParams.set(key, targetWidthStr);
        upgradedWidth = true;
        mutated = true;
      }
    }
  }

  for (const k of keysToDelete) {
    parsed.searchParams.delete(k);
  }

  if (upgradedWidth) {
    // Ensure a width parameter is present if resize/fit was removed
    const hasWidthParam = Array.from(parsed.searchParams.keys()).some((k) =>
      WIDTH_PARAM_KEYS.has(k.toLowerCase()) || k.toLowerCase() === 'sz' || k.toLowerCase() === 's' || k.toLowerCase() === 'size'
    );
    if (!hasWidthParam) {
      parsed.searchParams.set('w', targetWidthStr);
    }

    // Remove constraining small heights/crop flags so aspect ratio stays natural at high resolution
    for (const [key, val] of Array.from(parsed.searchParams.entries())) {
      const kLower = key.toLowerCase();
      if (HEIGHT_PARAM_KEYS.has(kLower) && /^\d+$/.test(val.trim()) && parseInt(val.trim(), 10) < 800) {
        parsed.searchParams.delete(key);
      } else if (kLower === 'crop' && (val.trim() === '1' || val.trim().toLowerCase() === 'true')) {
        parsed.searchParams.delete(key);
      } else if ((kLower === 'q' || kLower === 'quality') && /^\d+$/.test(val.trim()) && parseInt(val.trim(), 10) < 80) {
        parsed.searchParams.set(key, '85');
      }
    }
  }

  // Googleusercontent / Blogger URLs (=w200-h150-c, =s200, /s200/, /w200/)
  if (/(?:googleusercontent\.com|ggpht\.com|blogspot\.com)/i.test(parsed.hostname)) {
    const newPath = parsed.pathname
      .replace(/\/([sw])(\d+)(?:-[ch][a-z0-9-]*)?\//gi, (m, _prefix, digits) => {
        return parseInt(digits, 10) < 800 ? `/s${targetWidthStr}/` : m;
      })
      .replace(/=([sw])(\d+)(?:-[a-z0-9-]+)*$/i, (m, _prefix, digits) => {
        return parseInt(digits, 10) < 800 ? `=w${targetWidthStr}` : m;
      });
    if (newPath !== parsed.pathname) {
      parsed.pathname = newPath;
      mutated = true;
    }
  }

  return mutated ? parsed.toString() : clean;
}

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
