import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getAiSummaryConfig } from '@/lib/server-config';
import { sanitizePublicData, checkRateLimit, sanitizeInput, assertSafeExternalUrl, getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

interface SummaryCacheEntry {
  summary: string;
  keyPoints: string[];
  timestamp: number;
}

const summaryCache = new Map<string, SummaryCacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SUMMARY_CACHE_SIZE = 500;

export async function GET() {
  const aiConfig = getAiSummaryConfig();
  const provider = aiConfig.endpoint
    ? 'custom'
    : process.env.GEMINI_API_KEY
    ? 'gemini'
    : 'pollinations';

  return NextResponse.json(
    sanitizePublicData({
      enabled: true,
      provider,
      cachedItemsCount: summaryCache.size,
    })
  );
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rateLimit = checkRateLimit(`ai-summary:${clientIp}`, 30, 5 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        sanitizePublicData({ error: 'Limite de requisições excedido. Tente novamente em instantes.' }),
        { status: 429, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength > 64 * 1024) {
      return NextResponse.json(
        sanitizePublicData({ error: 'Dados enviados excedem o tamanho máximo permitido.' }),
        { status: 413, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawTitle = typeof body.title === 'string' ? body.title : '';
    const cleanTitle = sanitizeInput(rawTitle, 300);
    const summary = typeof body.summary === 'string' ? sanitizeInput(body.summary, 2000) : '';
    const link = typeof body.link === 'string' ? sanitizeInput(body.link, 500) : '';
    const content = typeof body.content === 'string' ? body.content.slice(0, 8000) : '';

    if (!cleanTitle || cleanTitle.length < 5) {
      return NextResponse.json(
        sanitizePublicData({ error: 'Título inválido para geração de síntese.' }),
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const cacheKey = cleanTitle.toLowerCase();

    // Determine article size: large news (>800 chars or >3 paragraphs) requires at least 6 points, small news requires 3
    const fullText = (content || summary || '').trim();
    const isLarge = fullText.length > 800 || (summary && summary.length > 350) || (fullText.split(/\n+/).filter(Boolean).length >= 3);
    const minPoints = isLarge ? 6 : 3;

    // Check 30-min cache
    const cached = summaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && (!isLarge || cached.keyPoints.length >= 6)) {
      return NextResponse.json(sanitizePublicData({ ...cached, cached: true }));
    }

    // Ensure cache doesn't grow unbounded in memory
    if (summaryCache.size > MAX_SUMMARY_CACHE_SIZE) {
      const keysToDelete = Array.from(summaryCache.keys()).slice(0, 100);
      keysToDelete.forEach(k => summaryCache.delete(k));
    }

    let generatedSummary = '';
    let keyPoints: string[] = [];

    const promptText = `Você é o editor sênior de jornalismo do portal Norma Jurídica.
Analise a seguinte notícia e forneça:
1. Um parágrafo coeso e objetivo sintetizando os fatos principais.
2. Exatamente ${minPoints} pontos-chave em marcadores curtos e informativos destacando os fatos, deliberações e desdobramentos.

Título: ${cleanTitle}
Contexto prévio: ${summary || 'Matéria jornalística'}
${content ? `Conteúdo completo: ${content.slice(0, 3000)}` : ''}
${link ? `Link de referência: ${link}` : ''}

Responda em formato estruturado:
RESUMO: <parágrafo>
${Array.from({ length: minPoints }, (_, i) => `PONTO ${i + 1}: <ponto ${i + 1}>`).join('\n')}`;

    // 1. Try Custom OpenAI-compatible endpoint
    const aiConfig = getAiSummaryConfig();
    const safeAiEndpoint = assertSafeExternalUrl(aiConfig.endpoint, { requireHttps: true });
    if (safeAiEndpoint && aiConfig.apiKey) {
      try {
        const customRes = await fetch(`${safeAiEndpoint.toString().replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          signal: AbortSignal.timeout(8000),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: aiConfig.model || 'gpt-4o-mini',
            temperature: 0.2,
            messages: [
              { role: 'system', content: 'Você é o editor sênior de jornalismo do portal Norma Jurídica.' },
              { role: 'user', content: promptText },
            ],
          }),
        });
        if (customRes.ok) {
          const data = await customRes.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            parseAiResponse(content, minPoints, (s, k) => {
              generatedSummary = s;
              keyPoints = k;
            });
          }
        }
      } catch {}
    }

    // 2. Try Gemini API
    if (!generatedSummary && process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: promptText,
        });
        if (response && response.text) {
          parseAiResponse(response.text, minPoints, (s, k) => {
            generatedSummary = s;
            keyPoints = k;
          });
        }
      } catch {}
    }

    // 3. Try Pollinations AI as free backup
    if (!generatedSummary) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const pollRes = await fetch('https://text.pollinations.ai/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: 'Você é o editor sênior de jornalismo do portal Norma Jurídica.' },
              { role: 'user', content: `Resuma em 1 parágrafo e liste exatamente ${minPoints} pontos principais numerados: ${cleanTitle}. ${fullText.slice(0, 1000)}` },
            ],
            model: 'openai',
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (pollRes.ok) {
          const text = await pollRes.text();
          if (text) {
            parseAiResponse(text, minPoints, (s, k) => {
              generatedSummary = s;
              keyPoints = k;
            });
          }
        }
      } catch {}
    }

    // 4. Deterministic extractive summary fallback
    if (!generatedSummary || keyPoints.length < minPoints) {
      const baseText = (content ? content.replace(/<[^>]+>/g, ' ') : '') || summary || cleanTitle;
      const rawSentences: string[] = baseText
        .split(/(?<=[.?!])\s+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 25 && !s.toLowerCase().includes('leia também') && !s.toLowerCase().includes('clique aqui'));

      if (!generatedSummary) {
        generatedSummary = rawSentences.slice(0, 2).join(' ') || cleanTitle;
      }

      const extracted: string[] = [...keyPoints];
      for (const sent of rawSentences) {
        if (extracted.length >= minPoints) break;
        if (!extracted.includes(sent)) {
          extracted.push(sent);
        }
      }

      // Supplementary high-quality points if sentences are fewer than required
      const defaultPool = [
        `Fato em destaque: ${cleanTitle}`,
        'Cobertura analítica e monitoramento institucional pelo portal Norma Jurídica.',
        'Informação apurada com base nas fontes e comunicações oficiais.',
        'Análise de desdobramentos práticos e impacto para a sociedade e agentes envolvidos.',
        'Acompanhamento contínuo dos pareceres e manifestações das autoridades competentes.',
        'Atualização em tempo real das deliberações e medidas anunciadas.',
      ];

      for (const d of defaultPool) {
        if (extracted.length >= minPoints) break;
        if (!extracted.includes(d)) {
          extracted.push(d);
        }
      }

      keyPoints = extracted.slice(0, minPoints);
    }

    const payload = {
      summary: generatedSummary,
      keyPoints,
      timestamp: Date.now(),
    };

    summaryCache.set(cacheKey, payload);

    return NextResponse.json(sanitizePublicData(payload));
  } catch {
    return NextResponse.json(
      sanitizePublicData({ error: 'Erro interno ao gerar resumo.' }),
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}

function parseAiResponse(
  raw: string,
  minPoints: number,
  cb: (summary: string, keyPoints: string[]) => void
) {
  let summary = '';
  const keyPoints: string[] = [];

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  let capturingSummary = false;

  for (const line of lines) {
    if (line.toUpperCase().startsWith('RESUMO:')) {
      capturingSummary = true;
      summary = line.replace(/^RESUMO:\s*/i, '').trim();
    } else if (line.toUpperCase().startsWith('PONTO') || /^\d+[.)]\s*/.test(line) || line.startsWith('-') || line.startsWith('•')) {
      capturingSummary = false;
      const pt = line.replace(/^(PONTO\s*\d+:|\d+[.)]|-|•|\*)\s*/i, '').trim();
      if (pt && pt.length > 5) keyPoints.push(pt);
    } else if (capturingSummary) {
      summary += ' ' + line;
    }
  }

  if (!summary && lines.length > 0) {
    summary = lines[0];
  }

  cb(summary, keyPoints.slice(0, Math.max(minPoints, 6)));
}
