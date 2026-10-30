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

export function cleanFullNewsText(text: string): string {
  if (!text) return '';
  let cleaned = fixEncoding(text);

  // Remove blocked brand references in text
  for (const term of BLOCKED_BRAND_TERMS) {
    const reg = new RegExp(`\\b${term}\\b`, 'gi');
    cleaned = cleaned.replace(reg, 'Norma Jurídica');
  }

  // Remove common upstream artifact phrases like "resultado de Portal News"
  cleaned = cleaned.replace(/resultado de Norma Jurídica/gi, 'informações apuradas pela redação');
  cleaned = cleaned.replace(/publicado em Norma Jurídica/gi, 'publicado no portal');
  cleaned = cleaned.replace(/conforme Norma Jurídica apurou/gi, 'conforme apuração editorial');

  return removeTruncationMarkers(cleaned);
}
