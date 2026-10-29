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

export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&#\d+;/g, (match) => {
      const num = parseInt(match.replace(/&#|;/g, ''), 10);
      return !isNaN(num) ? String.fromCharCode(num) : match;
    });
}

export function cleanTitle(title: string): string {
  if (!title) return '';
  let cleaned = decodeHtmlEntities(title).trim();
  
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
  let cleaned = decodeHtmlEntities(text);

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
