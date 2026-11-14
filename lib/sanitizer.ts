// lib/sanitizer.ts

export const BLOCKED_BRAND_TERMS = [
  'Portal News',
  'PORTAL NEWS',
  'portal-news',
  'Portal News PA',
  'G1',
  'g1',
  'Globo',
  'globo.com',
  'g1.globo.com',
  'ge.globo.com',
  'G1 Pará',
  'G1 Tocantins',
  'G1 Goiás',
  'G1 Santa Catarina',
  'TV Liberal',
  'TV Anhanguera',
  'Rede Globo',
  'UOL',
  'Folha de S.Paulo',
  'Estadão',
  'Metrópoles',
  'CNN Brasil',
];

const MOJIBAKE_MAP: [RegExp, string][] = [
  [/Ã¡/g, 'á'], [/Ã©/g, 'é'], [/Ã­/g, 'í'], [/Ã³/g, 'ó'], [/Ãº/g, 'ú'],
  [/Ã\u00AD/g, 'í'], [/Ã\u008D/g, 'Í'],
  [/Ã /g, 'à'], [/Ã\u00A0/g, 'à'], [/Ã¢/g, 'â'], [/Ãª/g, 'ê'], [/Ã´/g, 'ô'],
  [/Ã£/g, 'ã'], [/Ãµ/g, 'õ'],
  [/Ã§/g, 'ç'], [/Ã‡/g, 'Ç'],
  [/Ã/g, 'Á'], [/Ã‰/g, 'É'], [/Ã\u0081/g, 'Á'], [/Ã\u0089/g, 'É'], [/Ã“/g, 'Ó'], [/Ãš/g, 'Ú'],
  [/Ã€/g, 'À'], [/Ã‚/g, 'Â'], [/ÃŠ/g, 'Ê'], [/Ã”/g, 'Ô'], [/Ãƒ/g, 'Ã'], [/Ã•/g, 'Õ'],
  [/Âº/g, 'º'], [/Âª/g, 'ª'], [/Â°/g, '°'], [/Â§/g, '§'], [/Â /g, ' '],
  [/â€“/g, '–'], [/â€”/g, '—'], [/â€˜/g, '‘'], [/â€™/g, '’'], [/â€œ/g, '“'], [/â€/g, '”'],
  [/â€¢/g, '•'], [/â€¦/g, '…'], [/â€/g, '—'],
];

const HTML_NAMED_ENTITIES: Record<string, string> = {
  '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó', '&uacute;': 'ú',
  '&Aacute;': 'Á', '&Eacute;': 'É', '&Iacute;': 'Í', '&Oacute;': 'Ó', '&Uacute;': 'Ú',
  '&atilde;': 'ã', '&otilde;': 'õ', '&Atilde;': 'Ã', '&Otilde;': 'Õ',
  '&acirc;': 'â', '&ecirc;': 'ê', '&icirc;': 'î', '&ocirc;': 'ô', '&ucirc;': 'û',
  '&Acirc;': 'Â', '&Ecirc;': 'Ê', '&Icirc;': 'Î', '&Ocirc;': 'Ô', '&Ucirc;': 'Û',
  '&agrave;': 'à', '&egrave;': 'è', '&igrave;': 'ì', '&ograve;': 'ò', '&ugrave;': 'ù',
  '&Agrave;': 'À', '&Egrave;': 'È', '&Igrave;': 'Ì', '&Ograve;': 'Ò', '&Ugrave;': 'Ù',
  '&ccedil;': 'ç', '&Ccedil;': 'Ç',
  '&uuml;': 'ü', '&Uuml;': 'Ü',
  '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#039;': "'", '&lt;': '<', '&gt;': '>',
  '&nbsp;': ' ', '&#160;': ' ', '&ordf;': 'ª', '&ordm;': 'º', '&bull;': '•',
  '&ndash;': '–', '&mdash;': '—', '&lsquo;': '‘', '&rsquo;': '’', '&ldquo;': '“', '&rdquo;': '”',
  '&hellip;': '…', '&copy;': '©', '&reg;': '®', '&deg;': '°',
  '&#8217;': "'", '&#8216;': "'", '&#8220;': '"', '&#8221;': '"',
  '&#8211;': '–', '&#8212;': '—',
};

export function fixEncoding(str: string): string {
  if (!str) return '';
  let res = str;

  // 1. Decode numeric & named HTML entities
  res = decodeHtmlEntities(res);

  // 2. Buffer conversion for general UTF-8 interpreted as Latin-1
  if (/(?:Ã[\u0080-\u00BF]|â€[\u0080-\u00BF]|Â[\u00A0-\u00BF])/.test(res)) {
    try {
      const fixed = Buffer.from(res, 'latin1').toString('utf8');
      if (!fixed.includes('\uFFFD')) {
        res = fixed;
      }
    } catch {}
  }

  // 3. Fallback explicit mojibake mapping
  for (const [pattern, replacement] of MOJIBAKE_MAP) {
    res = res.replace(pattern, replacement);
  }

  return res;
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  let res = str;

  // Replace known named entities
  for (const [entity, char] of Object.entries(HTML_NAMED_ENTITIES)) {
    res = res.replaceAll(entity, char);
    res = res.replaceAll(entity.toUpperCase(), char);
  }

  // Decimal entities &#123;
  res = res.replace(/&#(\d+);/g, (match, dec) => {
    const num = parseInt(dec, 10);
    return !isNaN(num) && num > 0 ? String.fromCodePoint(num) : match;
  });

  // Hexadecimal entities &#x1f;
  res = res.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    const num = parseInt(hex, 16);
    return !isNaN(num) && num > 0 ? String.fromCodePoint(num) : match;
  });

  return res;
}

export function cleanTitle(title: string): string {
  if (!title) return '';
  let cleaned = fixEncoding(title).trim();
  
  // Remove trailing video markers often left in titles
  cleaned = cleaned.replace(/;\s*(?:vídeo|video|veja o vídeo|assista)\s*$/i, '');
  cleaned = cleaned.replace(/\[(?:vídeo|video)\]/i, '');

  // Remove blocked brand terms
  for (const term of BLOCKED_BRAND_TERMS) {
    const reg = new RegExp(`\\b${term}\\b`, 'gi');
    cleaned = cleaned.replace(reg, '');
  }

  // Remove trailing dashes, pipes or clean up punctuation
  cleaned = cleaned
    .replace(/\s*[-–—|]\s*$/, '')
    .replace(/^\s*[-–—|]\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

export function removeTruncationMarkers(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[\.\.\.\]/g, '')
    .replace(/\[\+\]/g, '')
    .replace(/\.\.\.$/, '.')
    .replace(/…$/, '.')
    .replace(/Leia mais\.?$/i, '')
    .replace(/Veja mais\.?$/i, '')
    .replace(/Confira a matéria completa\.?$/i, '')
    .trim();
}

export function isForbiddenVideoPost(title: string, content?: string): boolean {
  const lowerTitle = (title || '').toLowerCase();
  
  // Forbidden video cues
  const videoCues = ['vídeo:', 'video:', 'assista ao vídeo', 'assista à íntegra', 'ao vivo:', 'íntegra do'];
  for (const cue of videoCues) {
    if (lowerTitle.startsWith(cue)) {
      return true;
    }
  }

  // If text is very short (< 25 words) and only invites to watch video
  if (content) {
    const plain = content.replace(/<[^>]+>/g, ' ').trim();
    const words = plain.split(/\s+/).filter(Boolean);
    if (words.length < 25) {
      const lowerPlain = plain.toLowerCase();
      if (
        lowerPlain.includes('assista') ||
        lowerPlain.includes('veja o vídeo') ||
        lowerPlain.includes('confira no vídeo')
      ) {
        return true;
      }
    }
  }

  return false;
}

export function replaceBrandTermsSafely(html: string): string {
  if (!html) return '';

  // Fix any previously corrupted glbimg or media URLs
  let sanitized = html.replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo');

  // Split into HTML tags and non-tag text nodes so attributes and URLs are never altered
  return sanitized.replace(/(<[^>]+>)|([^<]+)/g, (_match, tag, text) => {
    if (tag) return tag;
    if (!text) return '';

    let processed = text;
    // Strip soft hyphens that cause unwanted line breaks
    processed = processed.replace(/\u00AD/g, '').replace(/&shy;/g, '');

    for (const term of BLOCKED_BRAND_TERMS) {
      const reg = new RegExp(`\\b${term}\\b`, 'gi');
      processed = processed.replace(reg, 'Norma Jurídica');
    }

    processed = processed.replace(/resultado de Norma Jurídica/gi, 'informações apuradas pela redação');
    processed = processed.replace(/publicado em Norma Jurídica/gi, 'publicado no portal');
    processed = processed.replace(/conforme Norma Jurídica apurou/gi, 'conforme apuração editorial');
    return processed;
  });
}

export function cleanFullNewsText(text: string): string {
  if (!text) return '';
  let cleaned = fixEncoding(text);
  cleaned = replaceBrandTermsSafely(cleaned);
  return removeTruncationMarkers(cleaned);
}

export function stripHtmlTags(text: string): string {
  if (!text) return '';
  let cleaned = fixEncoding(text);
  cleaned = cleaned.replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo');
  // Strip complete AND truncated/unclosed HTML tags (e.g., "<img src='...' alt='Deputad")
  cleaned = cleaned.replace(/<[^>]*>?/gi, ' ');
  cleaned = cleaned.replace(/&lt;[^&]*(?:&gt;)?/gi, ' ');
  // Strip any residual dangling attribute fragments and Gazeta gallery credit dumps
  cleaned = cleaned.replace(/['"]?\s*href=['"]https?:\/\/static\.gazetaesportiva\.com\/uploads\/[^\s"'<>]*['"]?/gi, ' ');
  cleaned = cleaned.replace(/['"]?\s*data-thumb=['"][^'"]*['"]>?/gi, ' ');
  cleaned = cleaned.replace(
    /\(?\s*Foto(?:\s+por|:)\s*(?:MARCELLO\s+ZAMBRANA|Rubens\s+Chiri|Vitor\s+Silva|Giancarlo\s+Santorum|Marcos\s+Ribolli|Cesar\s+Greco|Ale\s+Frata|Miguel\s+Schincariol|AGIF|AFP|Gazeta\s+Press)[^<\n)]*\)?/gi,
    ' '
  );
  cleaned = cleaned.replace(/\b(?:alt|src|href|class|style|width|height|loading|decoding|fetchpriority|referrerpolicy)=["'][^"']*["']?/gi, ' ');
  cleaned = cleaned.replace(/\u00AD/g, '').replace(/&shy;/g, '');
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

export function normalizeImageKey(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim().replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo');
  // Strip query string and hash
  clean = clean.split('#')[0].split('?')[0];
  // If Globo internal_photos proxy URL, canonicalize on internal_photos path
  const glbIdx = clean.indexOf('/internal_photos/');
  if (glbIdx !== -1) {
    clean = clean.slice(glbIdx);
  } else {
    clean = clean.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  }
  // Strip WordPress dimension suffixes like -1024x683 or -1200x650 or -scaled before extension
  clean = clean.replace(/(?:-\d+x\d+|-scaled)(\.(?:jpe?g|png|webp|gif|avif))$/i, '$1');
  return clean.toLowerCase();
}

export function extractAllImagesFromHtml(html: string): string[] {
  if (!html) return [];
  const images: string[] = [];
  const seenKeys = new Set<string>();
  const add = (url?: string) => {
    if (!url || typeof url !== 'string') return;
    const u = url.trim().replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo');
    if (!u.startsWith('http://') && !u.startsWith('https://')) return;
    const lower = u.toLowerCase();
    if (lower.includes('placeholder') || lower.includes('data:image') || lower.includes('blank.gif') || lower.includes('1x1')) return;
    const key = normalizeImageKey(u);
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      images.push(u);
    }
  };

  // Extract from <img> src attributes only (genuine images in content)
  const imgRegex = /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    add(match[1]);
  }

  return images;
}

export function deduplicateArticleImagesHtml(html: string, excludeUrls: string[] = []): string {
  if (!html) return '';
  const seen = new Set<string>();
  for (const ex of excludeUrls) {
    const key = normalizeImageKey(ex);
    if (key) seen.add(key);
  }

  let res = html.replace(/<img\b([^>]*)>/gi, (fullTag, attrs) => {
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    let src = srcMatch ? srcMatch[1].trim() : '';
    if (!src) return '';
    src = src.replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo');
    const lower = src.toLowerCase();
    if (
      lower.includes('placeholder') ||
      lower.includes('data:image') ||
      lower.includes('blank.gif') ||
      lower.includes('1x1')
    ) {
      return '';
    }

    const key = normalizeImageKey(src);
    if (!key || seen.has(key)) {
      return '';
    }
    seen.add(key);

    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : 'Imagem da matéria';

    return `<img src="${src}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-full h-auto object-cover rounded-xl my-4" />`;
  });

  // Clean up empty wrapper tags left after removing duplicate images
  res = res.replace(/<figure[^>]*>\s*<\/figure>/gi, '');
  res = res.replace(/<p>\s*(?:&nbsp;|\s)*<\/p>/gi, '');
  return res.trim();
}

export const API_SOURCE_DOMAINS: string[] = [
  'globo.com',
  'glbimg.com',
  'cnnbrasil.com.br',
  'exame.com',
  'gazetaesportiva.com',
  'ambitojuridico.com.br',
  'conjur.com.br',
  'diariodegoias.com.br',
  'folhadestra.com',
  'pmwnoticias.com.br',
  'atitudeto.com.br',
  'infoeducacao.com.br',
  'bico24horas.com.br',
  'clebertoledo.com.br',
  'vozdobico.com.br',
  'folhadobico.com.br',
  'gazetadocerrado.com.br',
  'jornalobico.com.br',
  'justa.org.br',
  'ludopedio.org.br',
  'meusitejuridico.editorajuspodivm.com.br',
  'minhaseconomias.com.br',
  'nacaojuridica.com.br',
  'odireito.com',
  'opiniaogoias.com.br',
  'portalnoticiasgoias.com.br',
  'rotajuridica.com.br',
  'santacatarinaempauta.com.br',
  'inw.org.br',
];

export interface ArticleLinkOptions {
  appUrl?: string;
  appDomain?: string;
  currentArticleSlug?: string;
  resolveSlugInDb?: (candidateSlug: string) => string | null;
  deferMissingLinkFallback?: boolean;
  extraSourceDomains?: string[];
}

export function isApiSourceDomain(hostname: string, extraDomains: string[] = []): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().replace(/^www\./, '');
  const all = extraDomains.length ? [...API_SOURCE_DOMAINS, ...extraDomains] : API_SOURCE_DOMAINS;
  return all.some((d) => {
    const clean = d.toLowerCase().replace(/^www\./, '');
    return host === clean || host.endsWith(`.${clean}`);
  });
}

export function isFileOrAssetUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.includes('/wp-content/uploads/') || pathname.includes('/attachment/')) {
      return true;
    }
    return /\.(?:pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|csv|txt|zip|rar|7z|tar|gz|jpe?g|png|webp|gif|svg|avif|bmp|ico|mp3|mp4|wav|ogg|m4a|aac|webm|ogv)$/.test(
      pathname
    );
  } catch {
    return /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|csv|txt|jpe?g|png|webp|gif)(?:[?#]|$)/i.test(rawUrl);
  }
}

export function extractSourceNewsSlug(rawUrl: string): string | null {
  if (!rawUrl || isFileOrAssetUrl(rawUrl)) return null;
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname;
    if (!pathname || pathname === '/') return null;

    // Ignore search/query-only pages like ?s=cultura
    if (parsed.searchParams.has('s') || parsed.searchParams.has('page_id')) {
      return null;
    }

    const lowerPath = pathname.toLowerCase();
    const nonArticlePrefixes = [
      '/tag/',
      '/tags/',
      '/category/',
      '/categoria/',
      '/categorias/',
      '/editoria/',
      '/autor/',
      '/author/',
      '/times/',
      '/todas-as-noticias',
      '/static/',
      '/sobre',
      '/contato',
      '/privacidade',
      '/termos',
      '/onboard',
      '/assine',
      '/login',
      '/cadastro',
      '/search',
      '/arquivo/',
      '/wp-json',
      '/feed',
    ];
    if (nonArticlePrefixes.some((p) => lowerPath.startsWith(p))) {
      return null;
    }

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    // Last meaningful path segment, stripped of article extension
    let last = segments[segments.length - 1]
      .replace(/\.(?:ghtml|html|htm|aspx|php)$/i, '')
      .toLowerCase()
      .trim();

    if (!last || /^\d+$/.test(last) || /^\d{4}-\d{2}-\d{2}$/.test(last)) {
      return null;
    }

    // Must look like an article slug (hyphenated words)
    const hyphenCount = (last.match(/-/g) || []).length;
    if (last.length < 10 || hyphenCount < 2) {
      return null;
    }

    // Clean disallowed characters cleanly matching slugify output
    last = last
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    return last.length >= 10 ? last : null;
  } catch {
    return null;
  }
}

function getHostnameSafe(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function processArticleLinksHtml(html: string, options: ArticleLinkOptions = {}): string {
  if (!html) return '';
  const appUrlPrefix = (options.appUrl || '').trim().replace(/\/+$/, '');
  const appUrlHost = appUrlPrefix ? getHostnameSafe(appUrlPrefix) : '';
  const appDomainHost = (options.appDomain || 'news.mirandinhacontabilidade.workers.dev').toLowerCase().replace(/^www\./, '');

  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (fullTag, rawAttrs: string, innerHtml: string) => {
    const hrefMatch = rawAttrs.match(/\bhref=["']([^"']*)["']/i);
    if (!hrefMatch) return fullTag;

    const rawHref = (hrefMatch[1] || '').trim();
    if (!rawHref) return fullTag;

    // Preserve intra-page anchors, mailto, tel cleanly without target="_blank"
    if (
      rawHref.startsWith('#') ||
      rawHref.startsWith('mailto:') ||
      rawHref.startsWith('tel:') ||
      rawHref.startsWith('javascript:')
    ) {
      return fullTag;
    }

    const rebuildAnchor = (nextHref: string, isExternal: boolean, markInternal = false) => {
      let attrs = rawAttrs
        .replace(/\bhref=["'][^"']*["']/gi, '')
        .replace(/\btarget=["'][^"']*["']/gi, '')
        .replace(/\brel=["'][^"']*["']/gi, '')
        .replace(/\bdata-app-link=["'][^"']*["']/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      const hasClass = /\bclass=["'][^"']*["']/i.test(attrs);
      const hasImg = /<img\b/i.test(innerHtml);
      if (!hasClass && !hasImg) {
        attrs = `${attrs} class="text-brand-700 dark:text-brand-400 underline underline-offset-2 font-medium hover:text-brand-800"`.trim();
      }

      const parts = [`href="${nextHref}"`];
      if (attrs) parts.push(attrs);
      if (isExternal) {
        parts.push('target="_blank"');
        parts.push('rel="noopener noreferrer"');
      } else if (markInternal) {
        parts.push('data-app-link="true"');
      }

      return `<a ${parts.join(' ')}>${innerHtml}</a>`;
    };

    const resolveInternalHref = (pathname: string, hash: string) => {
      const m = pathname.match(/^\/noticia\/([^/?#]+)\/?$/i);
      if (m) {
        let candidateSlug = m[1];
        try {
          candidateSlug = decodeURIComponent(candidateSlug);
        } catch {}
        candidateSlug = candidateSlug.toLowerCase().trim();

        const isTocOrSame =
          /\bez-toc-link\b/i.test(rawAttrs) ||
          (!!hash &&
            !!options.currentArticleSlug &&
            (candidateSlug === options.currentArticleSlug ||
              options.currentArticleSlug.includes(candidateSlug) ||
              candidateSlug.includes(options.currentArticleSlug)));

        if (isTocOrSame) {
          const targetSlug = options.currentArticleSlug || candidateSlug;
          return appUrlPrefix ? `${appUrlPrefix}/noticia/${targetSlug}${hash}` : `/noticia/${targetSlug}${hash}`;
        }

        if (options.resolveSlugInDb) {
          const matchedSlug = options.resolveSlugInDb(candidateSlug);
          if (matchedSlug) {
            return appUrlPrefix ? `${appUrlPrefix}/noticia/${matchedSlug}${hash}` : `/noticia/${matchedSlug}${hash}`;
          }
          if (options.deferMissingLinkFallback) {
            return appUrlPrefix ? `${appUrlPrefix}/noticia/${candidateSlug}${hash}` : `/noticia/${candidateSlug}${hash}`;
          }
          return appUrlPrefix ? `${appUrlPrefix}/` : '/';
        }

        return appUrlPrefix ? `${appUrlPrefix}/noticia/${candidateSlug}${hash}` : `/noticia/${candidateSlug}${hash}`;
      }

      if (pathname === '/' || pathname === '') {
        return appUrlPrefix ? `${appUrlPrefix}/` : '/';
      }
      return appUrlPrefix ? `${appUrlPrefix}${pathname}${hash}` : `${pathname}${hash}`;
    };

    // Already an internal relative path (e.g. /noticia/..., /)
    if (rawHref.startsWith('/') && !rawHref.startsWith('//')) {
      const [pathAndQuery, rawHash] = rawHref.split('#');
      const pathnameOnly = pathAndQuery.split('?')[0] || '/';
      const hash = rawHash ? `#${rawHash}` : '';
      return rebuildAnchor(resolveInternalHref(pathnameOnly, hash), false, true);
    }

    let parsed: URL;
    try {
      parsed = new URL(rawHref);
    } catch {
      return fullTag;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fullTag;
    }

    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // Own application domain or already rewritten to APP_URL
    if (
      (appUrlHost && (host === appUrlHost || host.endsWith(`.${appUrlHost}`))) ||
      (appDomainHost && (host === appDomainHost || host.endsWith(`.${appDomainHost}`))) ||
      /\bdata-app-link=["']true["']/i.test(rawAttrs)
    ) {
      return rebuildAnchor(resolveInternalHref(parsed.pathname, parsed.hash || ''), false, true);
    }

    // Check if link belongs to an API source domain
    if (isApiSourceDomain(host, options.extraSourceDomains)) {
      // Source files / uploads / attachments MUST stay intact and open in a new tab
      if (isFileOrAssetUrl(rawHref)) {
        return rebuildAnchor(rawHref, true, false);
      }

      const candidateSlug = extractSourceNewsSlug(rawHref);
      if (candidateSlug) {
        const hash = parsed.hash || '';
        const isTocOrSameArticle =
          /\bez-toc-link\b/i.test(rawAttrs) ||
          (!!hash &&
            !!options.currentArticleSlug &&
            (candidateSlug === options.currentArticleSlug ||
              options.currentArticleSlug.includes(candidateSlug) ||
              candidateSlug.includes(options.currentArticleSlug)));

        if (isTocOrSameArticle) {
          const targetSlug = options.currentArticleSlug || candidateSlug;
          const targetUrl = appUrlPrefix
            ? `${appUrlPrefix}/noticia/${targetSlug}${hash}`
            : `/noticia/${targetSlug}${hash}`;
          return rebuildAnchor(targetUrl, false, true);
        }

        if (options.resolveSlugInDb) {
          const matchedSlug = options.resolveSlugInDb(candidateSlug);
          if (matchedSlug) {
            const targetUrl = appUrlPrefix
              ? `${appUrlPrefix}/noticia/${matchedSlug}${hash}`
              : `/noticia/${matchedSlug}${hash}`;
            return rebuildAnchor(targetUrl, false, true);
          }
          if (options.deferMissingLinkFallback) {
            const targetUrl = appUrlPrefix
              ? `${appUrlPrefix}/noticia/${candidateSlug}${hash}`
              : `/noticia/${candidateSlug}${hash}`;
            return rebuildAnchor(targetUrl, false, true);
          }
          // Source news not present in local DB or API -> route to home page
          const homeUrl = appUrlPrefix ? `${appUrlPrefix}/` : '/';
          return rebuildAnchor(homeUrl, false, true);
        }

        // Without DB resolver (e.g. client fallback), point to app /noticia/:slug (server page checks DB + API or redirects to /)
        const targetUrl = appUrlPrefix
          ? `${appUrlPrefix}/noticia/${candidateSlug}${hash}`
          : `/noticia/${candidateSlug}${hash}`;
        return rebuildAnchor(targetUrl, false, true);
      }

      // Non-article links on source domain (tags, categories, search, home): keep & open in new tab
      return rebuildAnchor(rawHref, true, false);
    }

    // Rule for all other external websites: keep intact and open in new tab
    return rebuildAnchor(rawHref, true, false);
  });
}

export interface UnresolvedSourceNewsCandidate {
  candidateSlug: string;
  originalHref: string;
}

export function extractUnresolvedSourceNewsCandidates(
  html: string,
  options: {
    currentArticleSlug?: string;
    resolveSlugInDb?: (candidateSlug: string) => string | null;
    extraSourceDomains?: string[];
  } = {}
): UnresolvedSourceNewsCandidate[] {
  if (!html) return [];
  const seen = new Set<string>();
  const results: UnresolvedSourceNewsCandidate[] = [];
  const anchorRegex = /<a\b([^>]*)>/gi;
  let m: RegExpExecArray | null;

  while ((m = anchorRegex.exec(html)) !== null) {
    const attrs = m[1] || '';
    const hrefMatch = attrs.match(/\bhref=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const rawHref = (hrefMatch[1] || '').trim();
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
      continue;
    }

    let candidateSlug: string | null = null;
    if (rawHref.startsWith('/') && !rawHref.startsWith('//')) {
      const pathOnly = rawHref.split('#')[0].split('?')[0];
      const nm = pathOnly.match(/^\/noticia\/([^/?#]+)\/?$/i);
      if (nm) {
        try {
          candidateSlug = decodeURIComponent(nm[1]).toLowerCase().trim();
        } catch {
          candidateSlug = nm[1].toLowerCase().trim();
        }
      }
    } else {
      try {
        const parsed = new URL(rawHref);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
          const nm = parsed.pathname.match(/^\/noticia\/([^/?#]+)\/?$/i);
          if (nm && (/\bdata-app-link=["']true["']/i.test(attrs) || host.includes('news.mirandinhacontabilidade.workers.dev') || host.includes('normajuridica.com.br') || host.endsWith('.run.app'))) {
            candidateSlug = decodeURIComponent(nm[1]).toLowerCase().trim();
          } else if (isApiSourceDomain(host, options.extraSourceDomains) && !isFileOrAssetUrl(rawHref)) {
            candidateSlug = extractSourceNewsSlug(rawHref);
          }
        }
      } catch {}
    }

    if (!candidateSlug || candidateSlug.length < 6) continue;
    if (
      options.currentArticleSlug &&
      (candidateSlug === options.currentArticleSlug ||
        options.currentArticleSlug.includes(candidateSlug) ||
        candidateSlug.includes(options.currentArticleSlug))
    ) {
      continue;
    }
    if (options.resolveSlugInDb && options.resolveSlugInDb(candidateSlug)) {
      continue;
    }
    if (!seen.has(candidateSlug)) {
      seen.add(candidateSlug);
      results.push({ candidateSlug, originalHref: rawHref });
    }
  }

  return results;
}

export function matchSlugCandidate(
  candidateSlug: string,
  itemSlug?: string,
  itemTitleSlug?: string,
  itemLinkSlug?: string | null
): boolean {
  const cleanCandidate = (candidateSlug || '').toLowerCase().trim().replace(/^-+|-+$/g, '');
  if (cleanCandidate.length < 6) return false;

  const truncated85 =
    cleanCandidate.length > 85
      ? cleanCandidate.substring(0, 85).replace(/-[^-]*$/, '')
      : cleanCandidate;
  const prefix32 = truncated85.slice(0, Math.min(truncated85.length, 32));

  const targets = [itemSlug, itemTitleSlug, itemLinkSlug]
    .filter((v): v is string => typeof v === 'string' && v.trim().length >= 6)
    .map((v) => v.toLowerCase().trim().replace(/^-+|-+$/g, ''));

  for (const t of targets) {
    if (t === cleanCandidate || t === truncated85) return true;
    if (prefix32.length >= 24 && (t.startsWith(prefix32) || cleanCandidate.startsWith(t.slice(0, Math.min(t.length, 48))))) {
      if (t.length >= 24) return true;
    }
  }

  // Significant token overlap check (for cases where DB slug has id suffix or minor wording delta)
  const stopWords = new Set(['para', 'como', 'sobre', 'com', 'dos', 'das', 'que', 'uma', 'por', 'em', 'na', 'no', 'de', 'da', 'do', 'se', 'ao', 'aos']);
  const candTokens = cleanCandidate.split('-').filter((w) => w.length >= 3 && !stopWords.has(w));
  if (candTokens.length >= 4) {
    const candSet = new Set(candTokens);
    for (const t of targets) {
      const targetTokens = new Set(t.split('-').filter((w) => w.length >= 3 && !stopWords.has(w)));
      let overlap = 0;
      for (const tok of candSet) {
        if (targetTokens.has(tok)) overlap++;
      }
      if (overlap >= 4 && overlap / candSet.size >= 0.78) {
        return true;
      }
    }
  }

  return false;
}

export type ArticleContentBlock =
  | { type: 'html'; html: string }
  | { type: 'image'; src: string; alt: string; linkHref?: string; linkExternal?: boolean };

function sanitizeHtmlChunkAnchors(chunk: string): string {
  // Ensure no dangling opening <a ...> or stray closing </a> crosses block boundaries (prevents SSR hydration mismatch)
  let out = chunk.replace(/<a\b[^>]*>\s*$/gi, '').replace(/^\s*<\/a>/gi, '');
  const openCount = (out.match(/<a\b/gi) || []).length;
  const closeCount = (out.match(/<\/a>/gi) || []).length;
  if (openCount > closeCount) {
    out += '</a>'.repeat(openCount - closeCount);
  }
  return out.trim();
}

export function splitArticleHtmlIntoBlocks(
  html: string,
  excludeUrls: string[] = [],
  linkOptions?: ArticleLinkOptions
): ArticleContentBlock[] {
  const sanitized = repairAndSanitizeArticleHtml(html, excludeUrls, linkOptions);
  if (!sanitized) return [];

  // Unwrap <p> or <figure> containing only an <img> or <a><img></a> so image components don't nest inside <p>
  const unwrapped = sanitized
    .replace(/<p[^>]*>\s*((?:<a\b[^>]*>\s*)?<img\b[^>]*>(?:\s*<\/a>)?)\s*<\/p>/gi, '$1')
    .replace(/<figure[^>]*>\s*((?:<a\b[^>]*>\s*)?<img\b[^>]*>(?:\s*<\/a>)?)\s*<\/figure>/gi, '$1');

  const blocks: ArticleContentBlock[] = [];
  const mediaTagRegex = /<a\b([^>]*)>\s*<img\b([^>]*)>\s*<\/a>|<img\b([^>]*)>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mediaTagRegex.exec(unwrapped)) !== null) {
    const beforeHtml = sanitizeHtmlChunkAnchors(unwrapped.slice(lastIndex, match.index));
    if (beforeHtml && !/^<p>\s*<\/p>$/i.test(beforeHtml)) {
      blocks.push({ type: 'html', html: beforeHtml });
    }

    const anchorAttrs = match[1] || '';
    const imgAttrs = match[1] !== undefined ? match[2] || '' : match[3] || '';
    const srcMatch = imgAttrs.match(/src=["']([^"']+)["']/i);
    const altMatch = imgAttrs.match(/alt=["']([^"']*)["']/i);
    const src = srcMatch ? srcMatch[1].replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo').trim() : '';
    const alt = altMatch ? altMatch[1] : 'Imagem da matéria';

    const hrefMatch = anchorAttrs ? anchorAttrs.match(/\bhref=["']([^"']+)["']/i) : null;
    const linkHref = hrefMatch ? hrefMatch[1].trim() : undefined;
    const linkExternal = Boolean(anchorAttrs && /\btarget=["']_blank["']/i.test(anchorAttrs));

    if (src) {
      blocks.push({ type: 'image', src, alt, linkHref, linkExternal });
    }

    lastIndex = match.index + match[0].length;
  }

  const tailHtml = sanitizeHtmlChunkAnchors(unwrapped.slice(lastIndex));
  if (tailHtml && !/^<p>\s*<\/p>$/i.test(tailHtml)) {
    blocks.push({ type: 'html', html: tailHtml });
  }

  return blocks;
}

function buildVideoTag(url: string): string {
  const cleanUrl = url.trim();
  const ext = cleanUrl.split('?')[0].split('.').pop()?.toLowerCase();
  const mime = ext === 'webm' ? 'video/webm' : ext === 'ogv' ? 'video/ogg' : 'video/mp4';
  return `<video controls playsinline preload="metadata" width="100%" class="w-full h-auto aspect-video object-contain bg-black rounded-xl my-6">
  <source src="${cleanUrl}" type="${mime}" />
  Seu navegador não suporta a reprodução deste vídeo.
</video>`;
}

function buildAudioTag(url: string): string {
  const cleanUrl = url.trim();
  const ext = cleanUrl.split('?')[0].split('.').pop()?.toLowerCase();
  const mime =
    ext === 'ogg'
      ? 'audio/ogg'
      : ext === 'wav'
      ? 'audio/wav'
      : ext === 'm4a' || ext === 'aac'
      ? 'audio/mp4'
      : 'audio/mpeg';
  return `<audio controls preload="metadata" class="w-full my-4">
  <source src="${cleanUrl}" type="${mime}" />
  Seu navegador não suporta a reprodução deste áudio.
</audio>`;
}

export function repairAndSanitizeArticleHtml(
  html: string,
  excludeUrls: string[] = [],
  linkOptions?: ArticleLinkOptions
): string {
  if (!html) return '';
  let res = fixEncoding(html);

  // 1. Clean blocked brand names strictly in text nodes (never corrupting image/link URLs)
  res = replaceBrandTermsSafely(res);

  // 2. Clean out corrupted residual fragments or previously nested figures/wrappers
  res = res.replace(/<source\b[^>]*src=["']<figure[\s\S]*?<\/figure>["'][^>]*>/gi, '');
  res = res.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, '');
  res = res.replace(/<figure[^>]*>\s*(<video[\s\S]*?<\/video>)\s*<\/figure>/gi, '$1');
  res = res.replace(/<figure[^>]*>\s*(?:<div[^>]*>[\s\S]*?<\/div>\s*)?(<audio[\s\S]*?<\/audio>)\s*<\/figure>/gi, '$1');
  res = res.replace(/<p[^>]*>\s*Vídeo da reportagem\s*<\/p>/gi, '');
  res = res.replace(/<p[^>]*>\s*Podcast:\s*[\s\S]*?(?:Play in new window|Embed)[\s\S]*?<\/p>/gi, '');

  // Repair anchors split across <p> boundaries (e.g. <p><a ...></p><p><img .../></p><p>Title</p><p></a></p>)
  res = res.replace(
    /<p[^>]*>\s*<a\b([^>]*)>\s*<\/p>((?:(?!<a\b|<\/a>)[\s\S])*?)<p[^>]*>\s*<\/a>\s*<\/p>/gi,
    (_full, aAttrs: string, middle: string) => {
      const imgTags = middle.match(/<img\b[^>]*>/gi) || [];
      const textOnly = middle
        .replace(/<img\b[^>]*>/gi, '')
        .replace(/<\/?p[^>]*>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const parts: string[] = [];
      for (const imgTag of imgTags) {
        parts.push(`<p>${imgTag}</p>`);
      }
      if (textOnly) {
        parts.push(`<p><a ${aAttrs.trim()}>${textOnly}</a></p>`);
      } else if (imgTags.length > 0) {
        return `<a ${aAttrs.trim()}>${imgTags[0]}</a>`;
      }
      return parts.join('');
    }
  );

  // 3. Unwrap & normalize existing <video> and <audio> tags (including nested wp-audio-shortcode)
  res = res.replace(/<a\b[^>]*>\s*(<audio\b[^>]*>(?:(?!(?:<audio\b|<\/audio>))[\s\S])*<\/audio>)\s*<\/a>/gi, '$1');
  for (let i = 0; i < 3; i++) {
    const next = res.replace(
      /<audio\b[^>]*>(?:(?!(?:<audio\b|<\/audio>))[\s\S])*(<audio\b[^>]*>(?:(?!(?:<audio\b|<\/audio>))[\s\S])*<\/audio>)[\s\S]*?<\/audio>/gi,
      '$1'
    );
    if (next === res) break;
    res = next;
  }

  res = res.replace(
    /<video\b[^>]*>(?:(?!<\/video>)[\s\S])*<\/video>(?:\s*["']\s*target=["']_blank["'][^>]*>Abrir vídeo original[^<]*<\/a>(?:\s*<\/figcaption>\s*<\/figure>)?)?/gi,
    (block) => {
      const srcMatch =
        block.match(/<source\b[^>]*src=["'](https?:\/\/[^"']+)["']/i) ||
        block.match(/<video\b[^>]*src=["'](https?:\/\/[^"']+)["']/i);
      if (!srcMatch || !srcMatch[1]) {
        return '';
      }
      return buildVideoTag(srcMatch[1]);
    }
  );

  res = res.replace(/<audio\b[^>]*>(?:(?!<\/audio>)[\s\S])*<\/audio>/gi, (block) => {
    const srcMatch =
      block.match(/<source\b[^>]*src=["'](https?:\/\/[^"']+)["']/i) ||
      block.match(/<audio\b[^>]*src=["'](https?:\/\/[^"']+)["']/i) ||
      block.match(/href=["'](https?:\/\/[^"']+\.(?:mp3|wav|ogg|m4a|aac)[^"']*)["']/i);
    if (!srcMatch || !srcMatch[1]) {
      return '';
    }
    return buildAudioTag(srcMatch[1]);
  });

  // Clean any leftover broken "Abrir vídeo original" link fragments
  res = res.replace(
    /["']?\s*target=["']_blank["'][^>]*>Abrir vídeo original[^<]*<\/a>(?:\s*<\/figcaption>\s*<\/figure>)?/gi,
    ''
  );

  // 4. Convert standalone <a href="...mp4/mp3"> links into native <video>/<audio> tags
  res = res.replace(
    /(?:<p[^>]*>\s*)?<a\b[^>]*href=["'](https?:\/\/[^\s"'<>]+\.(?:mp4|webm|ogv)(?:\?[^\s"'<>]*)?)["'][^>]*>(?:(?!<\/a>)[\s\S])*<\/a>(?:\s*<\/p>)?/gi,
    (_m, url) => buildVideoTag(url)
  );
  res = res.replace(
    /(?:<p[^>]*>\s*)?<a\b[^>]*href=["'](https?:\/\/[^\s"'<>]+\.(?:mp3|wav|ogg|m4a|aac)(?:\?[^\s"'<>]*)?)["'][^>]*>(?:(?!<\/a>)[\s\S])*<\/a>(?:\s*<\/p>)?/gi,
    (_m, url) => buildAudioTag(url)
  );

  // 5. Convert bare media URLs ONLY in text nodes (never inside HTML attributes or existing <video>/<audio> blocks)
  res = res.replace(
    /(<video\b[^>]*>(?:(?!<\/video>)[\s\S])*<\/video>)|(<audio\b[^>]*>(?:(?!<\/audio>)[\s\S])*<\/audio>)|(<[^>]+>)|([^<]+)/gi,
    (match, videoTag, audioTag, tag, text) => {
      if (videoTag || audioTag || tag) return match;
      if (!text) return '';
      let out = text.replace(
        /(https?:\/\/[^\s"'<>]+\.(?:mp4|webm|ogv)(?:\?[^\s"'<>]*)?)/gi,
        (u: string) => buildVideoTag(u)
      );
      out = out.replace(
        /(https?:\/\/[^\s"'<>]+\.(?:mp3|wav|ogg|m4a|aac)(?:\?[^\s"'<>]*)?)/gi,
        (u: string) => buildAudioTag(u)
      );
      return out;
    }
  );

  // Unwrap <p><video>...</video></p> or <p><audio>...</audio></p>
  res = res.replace(/<p[^>]*>\s*(<video\b[\s\S]*?<\/video>)\s*<\/p>/gi, '$1');
  res = res.replace(/<p[^>]*>\s*(<audio\b[\s\S]*?<\/audio>)\s*<\/p>/gi, '$1');

  // 6. Remove repetitive match gallery dumps and residual credit lines from Gazeta feeds
  res = res.replace(
    /<figure[^>]*>\s*<img[^>]*static\.gazetaesportiva\.com\/uploads\/[^>]*>[\s\S]*?<\/figure>/gi,
    ''
  );
  res = res.replace(
    /<p[^>]*>\s*['"]?\s*href=['"]https?:\/\/static\.gazetaesportiva\.com\/uploads\/[\s\S]*?<\/p>/gi,
    ''
  );
  res = res.replace(
    /['"]?\s*href=['"]https?:\/\/static\.gazetaesportiva\.com\/uploads\/[^\s"'<>]*['"]?[^<\n]*(?:<\/p>)?/gi,
    ''
  );
  res = res.replace(
    /(?:<p[^>]*>)?\s*\(?\s*Foto(?:\s+por|:)\s*(?:MARCELLO\s+ZAMBRANA|Rubens\s+Chiri|Vitor\s+Silva|Giancarlo\s+Santorum|Marcos\s+Ribolli|Cesar\s+Greco|Ale\s+Frata|Miguel\s+Schincariol|AGIF|AFP|Gazeta\s+Press)[^<\n]*\)?\s*(?:<\/p>)?/gi,
    ''
  );
  res = res.replace(/(?:<p[^>]*>)?\s*\(?Foto(?:\s+por|:)[^<\n]{3,90}\)\s*<\/p>/gi, '');

  // 7. Clean any residual attribute fragments like ' data-thumb='...' or dangling quotes
  res = res.replace(/['"]?\s*data-thumb=['"][^'"]*['"]>?/gi, '');
  res = res.replace(/data-thumb=['"][^'"]*['"]/gi, '');

  // 8. Sanitize & deduplicate all genuine <img> tags (never duplicate featuredImage or repeat body images)
  res = deduplicateArticleImagesHtml(res, excludeUrls);

  // 9. Preserve external/file links in new tab and rewrite source-news links to APP_URL/DB/home
  res = processArticleLinksHtml(res, linkOptions);

  // 10. Remove empty paragraphs & stray orphaned closing </p> tags
  res = res.replace(/<p[^>]*>\s*(?:&nbsp;|\s)*<\/p>/gi, '');
  res = res.replace(/<\/p>\s*(?:<\/p>)+/gi, '</p>');

  return res.trim();
}
