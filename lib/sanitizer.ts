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
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  cleaned = cleaned.replace(/&lt;[^&]+&gt;/g, ' ');
  cleaned = cleaned.replace(/['"]?\s*data-thumb=['"][^'"]*['"]>?/gi, '');
  cleaned = cleaned.replace(/alt=['"][^'"]*['"]/gi, '');
  cleaned = cleaned.replace(/\u00AD/g, '').replace(/&shy;/g, '');
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

export function extractAllImagesFromHtml(html: string): string[] {
  if (!html) return [];
  const images: string[] = [];
  const add = (url?: string) => {
    if (!url || typeof url !== 'string') return;
    const u = url.trim();
    if (!u.startsWith('http://') && !u.startsWith('https://')) return;
    const lower = u.toLowerCase();
    if (lower.includes('placeholder') || lower.includes('data:image') || lower.includes('blank.gif') || lower.includes('1x1')) return;
    if (!images.includes(u)) images.push(u);
  };

  // Extract from <img> src attributes only (genuine images in content)
  const imgRegex = /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    add(match[1]);
  }

  return images;
}

export function repairAndSanitizeArticleHtml(html: string): string {
  if (!html) return '';
  let res = fixEncoding(html);

  // 1. Clean blocked brand names strictly in text nodes (never corrupting image/link URLs)
  res = replaceBrandTermsSafely(res);

  // 2. Clean out corrupted residual fragments or previously nested figures
  res = res.replace(/<source\b[^>]*src=["']<figure[\s\S]*?<\/figure>["'][^>]*>/gi, '');
  res = res.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, '');
  res = res.replace(/<figure[^>]*>\s*(<video[\s\S]*?<\/video>)\s*<\/figure>/gi, '$1');
  res = res.replace(/<figure[^>]*>\s*(?:<div[^>]*>[\s\S]*?<\/div>\s*)?(<audio[\s\S]*?<\/audio>)\s*<\/figure>/gi, '$1');
  res = res.replace(/<p>\s*Vídeo da reportagem\s*<\/p>/gi, '');
  res = res.replace(/<p>\s*Podcast:\s*Play in new window\s*\|\s*Embed\s*<\/p>/gi, '');

  // 3. Embed video files (.mp4, .webm, .ogv) with responsive width & proportional aspect-video height
  res = res.replace(
    /(?:<p>\s*)?(?:<a\b[^>]*href=["'])?(?<!src=["']|href=["'])(https?:\/\/[^\s"'<>]+\.(?:mp4|webm|ogv)[^\s"'<>]*)(?:["'][^>]*>.*?<\/a>)?(?:\s*<\/p>)?/gi,
    (match, videoUrl) => {
      if (match.includes('<video') || match.includes('<source')) return match;
      const cleanUrl = String(videoUrl || '').trim();
      if (!cleanUrl) return '';
      return `<video controls playsinline preload="metadata" class="w-full aspect-video object-contain bg-black rounded-xl my-6">
  <source src="${cleanUrl}" type="video/mp4" />
  Seu navegador não suporta a reprodução deste vídeo.
</video>`;
    }
  );

  // 4. Embed audio files (.mp3, .wav, .ogg, .m4a, .aac) solely with standard audio tag and controls
  res = res.replace(
    /(?:<p>\s*)?(?:<a\b[^>]*href=["'])?(?<!src=["']|href=["'])(https?:\/\/[^\s"'<>]+\.(?:mp3|wav|ogg|m4a|aac)[^\s"'<>]*)(?:["'][^>]*>.*?<\/a>)?(?:\s*<\/p>)?/gi,
    (match, audioUrl) => {
      if (match.includes('<audio') || match.includes('<source')) return match;
      const cleanUrl = String(audioUrl || '').trim();
      if (!cleanUrl) return '';
      return `<audio controls preload="metadata" class="w-full my-4">
  <source src="${cleanUrl}" type="audio/mpeg" />
  Seu navegador não suporta a reprodução deste áudio.
</audio>`;
    }
  );

  // 5. Remove repetitive match gallery dumps from Gazeta feeds (the 16 shared photos)
  res = res.replace(
    /<figure[^>]*>\s*<img[^>]*static\.gazetaesportiva\.com\/uploads\/[^>]*>[\s\S]*?<\/figure>/gi,
    ''
  );
  res = res.replace(
    /<p>\s*['"]?\s*href=['"]https?:\/\/static\.gazetaesportiva\.com\/uploads\/[^\s"'<>]*[\s\S]*?<\/p>/gi,
    ''
  );
  res = res.replace(
    /['"]?\s*href=['"]https?:\/\/static\.gazetaesportiva\.com\/uploads\/[^\s"'<>]*[\s\S]*?(?:<\/p>|$)/gi,
    ''
  );
  res = res.replace(/<p>\s*\(Foto por MARCELLO ZAMBRANA[^<]*?\)\s*<\/p>/gi, '');
  res = res.replace(/<p>\s*\(Foto:\s*Rubens Chiri[^<]*?\)\s*<\/p>/gi, '');
  res = res.replace(/<p>\s*\(Foto:\s*Vitor Silva[^<]*?\)\s*<\/p>/gi, '');
  res = res.replace(/<p>\s*\(Foto:\s*Giancarlo Santorum[^<]*?\)\s*<\/p>/gi, '');
  res = res.replace(/<p>\s*Foto por MARCELLO ZAMBRANA[^<]*?\)\s*<\/p>/gi, '');
  res = res.replace(/<p>\s*Foto:\s*Rubens Chiri[^<]*?\)\s*<\/p>/gi, '');

  // 6. Ensure all existing genuine <img> tags are safe, lazy-loaded, hotlink-resilient with referrerpolicy
  // Preserving original image URL without replacing with fallback cover.png
  res = res.replace(/<img\b([^>]*)>/gi, (fullTag, attrs) => {
    if (attrs.includes('referrerpolicy="no-referrer"')) {
      return fullTag;
    }
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    let src = srcMatch ? srcMatch[1] : '';
    if (!src) return '';
    src = src.replace(/s2-Norma\s*Jur[ií]dica/gi, 's2-globo');

    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : 'Imagem da matéria';

    return `<img src="${src}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-full h-auto object-cover rounded-xl my-4" />`;
  });

  // 7. Clean any residual attribute fragments like ' data-thumb='...' or dangling quotes
  res = res.replace(/['"]?\s*data-thumb=['"][^'"]*['"]>?/gi, '');
  res = res.replace(/data-thumb=['"][^'"]*['"]/gi, '');

  // 8. Remove empty paragraphs
  res = res.replace(/<p>\s*(?:&nbsp;|\s)*<\/p>/gi, '');

  return res.trim();
}
