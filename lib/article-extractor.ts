// lib/article-extractor.ts
import { cleanFullNewsText, decodeHtmlEntities } from './sanitizer';

export function extractArticleFromHtml(html: string): string {
  if (!html) return '';

  // Remove scripts, styles, iframes, and ads
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');

  // Look for article content container
  const articleMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch && articleMatch[1]) {
    cleaned = articleMatch[1];
  } else {
    const entryContent = cleaned.match(/class=["'][^"']*(?:entry-content|article-body|post-content|content-body)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section|article)>/i);
    if (entryContent && entryContent[1]) {
      cleaned = entryContent[1];
    }
  }

  // Extract paragraphs
  const pMatches = cleaned.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi);
  if (pMatches && pMatches.length > 0) {
    const validParagraphs = pMatches
      .map(p => p.replace(/<[^>]+>/g, '').trim())
      .filter(p => p.length > 25 && !p.toLowerCase().includes('leia mais') && !p.toLowerCase().includes('veja também'));

    if (validParagraphs.length > 0) {
      return validParagraphs.map(p => `<p>${cleanFullNewsText(p)}</p>`).join('\n\n');
    }
  }

  return cleanFullNewsText(cleaned.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim());
}

export async function fetchFullArticleBody(url: string, limit: number = 4500): Promise<string> {
  if (!url || !url.startsWith('http')) return '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NormaJuridica/1.0',
        'Accept': 'text/html,application/xhtml+xml',
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

export function ensureCompleteArticleText(text: string, title: string, category: string): string {
  if (text && text.trim().length >= 300) {
    // If text already has paragraphs, ensure sanitized
    if (text.includes('<p>')) {
      return cleanFullNewsText(text);
    }
    // Format paragraphs from line breaks
    const parts = text.split(/\n\s*\n/).filter(Boolean);
    if (parts.length > 1) {
      return parts.map(p => `<p>${cleanFullNewsText(p.trim())}</p>`).join('\n\n');
    }
    return `<p>${cleanFullNewsText(text.trim())}</p>`;
  }

  // If text is too short, enrich it professionally with journalistic context
  const cleanT = decodeHtmlEntities(title);
  const baseContent = text ? cleanFullNewsText(text) : cleanT;

  return `
    <p>${baseContent}</p>
    <p>O portal <strong>Norma Jurídica</strong> acompanha continuamente o desenrolar das informações em <strong>${category}</strong>, apurando atualizações institucionais, decisões oficiais e declarações das autoridades competentes.</p>
    <p>Nossa equipe editorial realiza o monitoramento dos desdobramentos deste fato, garantindo a publicação tempestiva de novas evidências, dados consolidados e esclarecimentos jurídicos de interesse público.</p>
  `.trim();
}
