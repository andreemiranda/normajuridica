// lib/article-extractor.ts
import { cleanFullNewsText, decodeHtmlEntities, stripHtmlTags } from './sanitizer';
import { upgradeImageResolution } from './image-url';
import { assertSafeExternalUrl } from './security';

const ABBREVIATIONS = [
  'Sr.', 'Sra.', 'Srs.', 'Sras.', 'Dr.', 'Dra.', 'Drs.', 'Dras.',
  'Prof.', 'Profa.', 'Exmo.', 'Exma.', 'Ilmo.', 'Ilma.',
  'Art.', 'Inc.', 'Par.', 'Al.', 'p.ex.', 'etc.', 'vs.', 'n.º', 'No.',
  'Ltda.', 'S.A.', 'S/A.', 'CIA.', 'Cia.', 'Tel.', 'Av.', 'R.',
  'Min.', 'Des.', 'Dep.', 'Sen.', 'Gov.', 'Pres.', 'Pref.', 'Ver.',
  'Jan.', 'Fev.', 'Mar.', 'Abr.', 'Mai.', 'Jun.', 'Jul.', 'Ago.', 'Set.', 'Out.', 'Nov.', 'Dez.',
];

const NOISE_LINE_REGEX = /^(?:leia mais|leia também|veja também|veja mais|saiba mais|confira também|assine a newsletter|siga nossas redes|participe do canal|entre no grupo|publicidade|anúncio|continue lendo)\b/i;

function splitPortugueseSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  let guarded = clean;
  // Guard common abbreviations and initials like A. Silva, 10.5, 1.000, art. 5
  for (let i = 0; i < ABBREVIATIONS.length; i++) {
    const abbr = ABBREVIATIONS[i];
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    guarded = guarded.replace(new RegExp(`\\b${escaped}`, 'g'), abbr.replace(/\./g, '@@DOT@@'));
  }
  guarded = guarded
    .replace(/\b([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])\./g, '$1@@DOT@@')
    .replace(/(\d)\.(\d)/g, '$1@@DOT@@$2')
    .replace(/\b(com|gov|org|edu|net)\.br\b/gi, '$1@@DOT@@br')
    .replace(/\.(com|org|net|br|io|dev)\b/gi, '@@DOT@@$1');

  const rawSentences = guarded
    .split(/(?<=[.!?]["'”’)]?)\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ“"'(\d])/)
    .map((s) => s.replace(/@@DOT@@/g, '.').trim())
    .filter(Boolean);

  return rawSentences.length > 0 ? rawSentences : [clean];
}

function splitLongParagraphText(text: string, targetChars = 360): string[] {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return [];
  if (trimmed.length <= 420) return [trimmed];

  const sentences = splitPortugueseSentences(trimmed);
  if (sentences.length <= 1) return [trimmed];

  const paragraphs: string[] = [];
  let bucket: string[] = [];
  let bucketLen = 0;

  for (const s of sentences) {
    if (bucket.length >= 2 && (bucketLen + s.length > targetChars || bucket.length >= 3)) {
      paragraphs.push(bucket.join(' ').trim());
      bucket = [s];
      bucketLen = s.length;
    } else {
      bucket.push(s);
      bucketLen += s.length + 1;
    }
  }
  if (bucket.length > 0) {
    paragraphs.push(bucket.join(' ').trim());
  }

  return paragraphs.filter(Boolean);
}

/**
 * Normalizes any HTML or plain-text article body into clean, balanced multi-paragraph HTML:
 * - Unwraps nested <p><p>...</p></p>
 * - Splits <br><br> or newline blocks into distinct <p> blocks
 * - Splits giant single-paragraph blobs (> 420 chars) into natural 2-3 sentence paragraphs
 */
export function formatArticleParagraphsHtml(rawHtmlOrText: string): string {
  if (!rawHtmlOrText) return '';
  let input = String(rawHtmlOrText).replace(/\r\n/g, '\n').trim();
  if (!input) return '';

  // Unwrap accidental double <p><p> wrappers
  for (let i = 0; i < 3; i++) {
    const next = input
      .replace(/<p\b[^>]*>\s*<p\b([^>]*)>/gi, '<p$1>')
      .replace(/<\/p>\s*<\/p>/gi, '</p>');
    if (next === input) break;
    input = next;
  }

  // Convert explicit <br> breaks into paragraph separations when not wrapping block tags
  input = input.replace(/(?:<br\s*\/?>\s*){2,}/gi, '</p><p>');

  const hasBlockTags = /<(?:p|h[1-6]|ul|ol|blockquote|figure|video|audio|table)\b/i.test(input);
  if (!hasBlockTags) {
    const plainLines = input
      .replace(/<br\s*\/?>/gi, '\n')
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !NOISE_LINE_REGEX.test(l));

    const expanded: string[] = [];
    for (const line of plainLines) {
      for (const chunk of splitLongParagraphText(cleanFullNewsText(line))) {
        expanded.push(`<p>${chunk}</p>`);
      }
    }
    return expanded.join('\n');
  }

  // Process existing block elements, splitting oversized plain <p> blocks cleanly
  const out = input.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (_full, attrs: string, inner: string) => {
    const trimmedInner = (inner || '').trim();
    if (!trimmedInner) return '';

    // Preserve media or nested markup paragraphs untouched (only clean <br> splitting if purely text)
    if (/<(?:img|video|audio|iframe|figure|table|ul|ol|blockquote)\b/i.test(trimmedInner)) {
      return `<p${attrs}>${cleanFullNewsText(trimmedInner)}</p>`;
    }

    // If paragraph contains single <br> tags, split on them first
    const subParts = trimmedInner
      .split(/<br\s*\/?>|\n+/gi)
      .map((s) => s.trim())
      .filter(Boolean);

    const hasInlineLinksOrFormat = /<(?:a|strong|em|b|i|mark|u|s)\b/i.test(trimmedInner);
    if (hasInlineLinksOrFormat && subParts.length <= 1) {
      const plainCheck = stripHtmlTags(trimmedInner);
      if (NOISE_LINE_REGEX.test(plainCheck)) return '';
      return `<p${attrs}>${cleanFullNewsText(trimmedInner)}</p>`;
    }

    const resultBlocks: string[] = [];
    for (const part of subParts.length > 0 ? subParts : [trimmedInner]) {
      const plainPart = stripHtmlTags(part);
      if (!plainPart || NOISE_LINE_REGEX.test(plainPart)) continue;
      if (/<(?:a|strong|em|b|i|mark|u|s)\b/i.test(part)) {
        resultBlocks.push(`<p>${cleanFullNewsText(part)}</p>`);
      } else {
        const textToSplit = part.replace(/<[^>]+>/g, ' ').trim();
        for (const chunk of splitLongParagraphText(cleanFullNewsText(textToSplit))) {
          resultBlocks.push(`<p>${chunk}</p>`);
        }
      }
    }
    return resultBlocks.join('\n');
  });

  // Also ensure any leading/trailing loose plain text outside tags becomes <p>
  const pCount = (out.match(/<p\b/gi) || []).length;
  if (pCount === 0) {
    const plain = stripHtmlTags(out);
    if (!plain) return '';
    return splitLongParagraphText(cleanFullNewsText(plain))
      .map((c) => `<p>${c}</p>`)
      .join('\n');
  }

  return out.replace(/<p[^>]*>\s*(?:&nbsp;|\s)*<\/p>/gi, '').trim();
}

export function extractArticleFromHtml(html: string): string {
  if (!html) return '';

  // Remove scripts, styles, iframes, nav, footer, aside, form, noscript
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

  // Isolate main editorial container without letting nested </div> terminate prematurely
  const articleMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch && articleMatch[1] && articleMatch[1].length > 300) {
    cleaned = articleMatch[1];
  } else {
    const containerPatterns = [
      /<[^>]+(?:itemprop=["']articleBody["']|class=["'][^"']*(?:entry-content|article-body|post-content|materia-conteudo|content-text|td-post-content|mc-article-body)[^"']*["'])[^>]*>/i,
      /<main\b[^>]*>/i,
    ];
    for (const rx of containerPatterns) {
      const m = rx.exec(cleaned);
      if (m) {
        const startIdx = m.index + m[0].length;
        const endMain = cleaned.indexOf('</main>', startIdx);
        const endFooter = cleaned.indexOf('<footer', startIdx);
        const sliceEnd =
          endMain !== -1
            ? endMain
            : endFooter !== -1
              ? endFooter
              : Math.min(cleaned.length, startIdx + 48000);
        const slice = cleaned.slice(startIdx, sliceEnd);
        if (slice.length > 250) {
          cleaned = slice;
          break;
        }
      }
    }
  }

  // Extract semantic editorial blocks (headings, paragraphs, blockquotes, lists, figures)
  const blockMatches = cleaned.match(
    /<(h[2-4]|p|blockquote)\b[^>]*>[\s\S]*?<\/\1>|<figure\b[^>]*>[\s\S]*?<\/figure>/gi
  );

  if (blockMatches && blockMatches.length > 0) {
    const blocks: string[] = [];
    for (const rawBlock of blockMatches) {
      const tagMatch = rawBlock.match(/^<([a-z0-9]+)/i);
      const tag = (tagMatch?.[1] || 'p').toLowerCase();

      if (tag === 'figure') {
        const imgSrcMatch = rawBlock.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
        if (imgSrcMatch?.[1]) {
          const upgraded = upgradeImageResolution(imgSrcMatch[1]);
          if (upgraded.startsWith('http')) {
            blocks.push(`<p><img src="${upgraded}" alt="Imagem da reportagem" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></p>`);
          }
        }
        continue;
      }

      const plain = stripHtmlTags(rawBlock).trim();
      if (plain.length < 20) continue;
      if (NOISE_LINE_REGEX.test(plain)) continue;
      if (/^(?:©|todos os direitos|atualizado em \d|por redação$)/i.test(plain) && plain.length < 70) {
        continue;
      }

      const safeText = cleanFullNewsText(plain);
      if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
        blocks.push(`<${tag}>${safeText}</${tag}>`);
      } else if (tag === 'blockquote') {
        blocks.push(`<blockquote><p>${safeText}</p></blockquote>`);
      } else {
        blocks.push(`<p>${safeText}</p>`);
      }
    }

    if (blocks.length > 0) {
      return formatArticleParagraphsHtml(blocks.join('\n'));
    }
  }

  const fallbackPlain = cleanFullNewsText(stripHtmlTags(cleaned));
  return formatArticleParagraphsHtml(fallbackPlain);
}

export async function fetchFullArticleBody(url: string, limit: number = 50000): Promise<string> {
  const safeUrl = assertSafeExternalUrl(url);
  if (!safeUrl) return '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);

    const res = await fetch(safeUrl.toString(), {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 NormaJuridica/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      next: { revalidate: 3600 },
    });
    clearTimeout(timeout);

    if (!res.ok) return '';
    const html = await res.text();
    const extracted = extractArticleFromHtml(html);
    return extracted.slice(0, limit);
  } catch {
    return '';
  }
}

export function ensureCompleteArticleText(text: string, _title?: string, _category?: string): string {
  const formatted = formatArticleParagraphsHtml(text || '');
  if (formatted) {
    return formatted;
  }
  const cleaned = cleanFullNewsText(text || '');
  return cleaned ? `<p>${cleaned}</p>` : '';
}
