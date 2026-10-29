import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { SITE_CONFIG } from '@/lib/site-config';
import { sanitizePublicData } from '@/lib/security';

export const dynamic = 'force-dynamic';

interface SummaryCacheEntry {
  summary: string;
  keyPoints: string[];
  timestamp: number;
}

const summaryCache = new Map<string, SummaryCacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  const provider = SITE_CONFIG.aiSummary.endpoint
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
    const body = await req.json().catch(() => ({}));
    const { title, summary, link } = body;

    if (!title || typeof title !== 'string' || title.trim().length < 5) {
      return NextResponse.json(
        sanitizePublicData({ error: 'Título inválido para geração de síntese.' }),
        { status: 400 }
      );
    }

    const cleanTitle = title.trim();
    const cacheKey = cleanTitle.toLowerCase();

    // Check 30-min cache
    const cached = summaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(sanitizePublicData({ ...cached, cached: true }));
    }

    let generatedSummary = '';
    let keyPoints: string[] = [];

    const promptText = `Você é o editor sênior de jornalismo do portal Norma Jurídica.
Analise a seguinte notícia e forneça:
1. Um parágrafo coeso e objetivo sintetizando os fatos principais.
2. Exatamente 3 pontos-chave em marcadores curtos.

Título: ${cleanTitle}
Contexto prévio: ${summary || 'Matéria jornalística'}
${link ? `Link de referência: ${link}` : ''}

Responda em formato estruturado:
RESUMO: <parágrafo>
PONTO 1: <ponto 1>
PONTO 2: <ponto 2>
PONTO 3: <ponto 3>`;

    // 1. Try Custom OpenAI-compatible endpoint
    if (SITE_CONFIG.aiSummary.endpoint && SITE_CONFIG.aiSummary.apiKey) {
      try {
        const customRes = await fetch(`${SITE_CONFIG.aiSummary.endpoint.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SITE_CONFIG.aiSummary.apiKey}`,
          },
          body: JSON.stringify({
            model: SITE_CONFIG.aiSummary.model || 'gpt-4o-mini',
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
            parseAiResponse(content, (s, k) => {
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
          parseAiResponse(response.text, (s, k) => {
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
              { role: 'user', content: `Resuma em 1 parágrafo jornalístico claro e liste 3 pontos principais: ${cleanTitle}. ${summary || ''}` },
            ],
            model: 'openai',
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (pollRes.ok) {
          const text = await pollRes.text();
          if (text) {
            parseAiResponse(text, (s, k) => {
              generatedSummary = s;
              keyPoints = k;
            });
          }
        }
      } catch {}
    }

    // 4. Deterministic extractive summary fallback
    if (!generatedSummary) {
      const baseText = summary || cleanTitle;
      const sentences = baseText.split(/(?<=[.?!])\s+/).filter(Boolean);
      generatedSummary = sentences.slice(0, 2).join(' ') || cleanTitle;
      keyPoints = [
        `Fato em destaque: ${cleanTitle}`,
        'Cobertura em tempo real e monitoramento institucional pelo portal Norma Jurídica.',
        'Informação apurada com base nas fontes e comunicações oficiais.',
      ];
    }

    const payload = {
      summary: generatedSummary,
      keyPoints: keyPoints.length > 0 ? keyPoints : [
        `Informações consolidadas sobre: ${cleanTitle}`,
        'Acompanhamento contínuo dos desdobramentos pelas autoridades competentes.',
        'Análise jurídica e de impacto público disponível no Norma Jurídica.',
      ],
      timestamp: Date.now(),
    };

    summaryCache.set(cacheKey, payload);

    return NextResponse.json(sanitizePublicData(payload));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro ao gerar resumo';
    return NextResponse.json(
      sanitizePublicData({ error: errorMsg }),
      { status: 500 }
    );
  }
}

function parseAiResponse(
  raw: string,
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
    } else if (line.toUpperCase().startsWith('PONTO') || line.startsWith('-') || line.startsWith('•')) {
      capturingSummary = false;
      const pt = line.replace(/^(PONTO\s*\d+:|-|•|\*)\s*/i, '').trim();
      if (pt) keyPoints.push(pt);
    } else if (capturingSummary) {
      summary += ' ' + line;
    }
  }

  if (!summary && lines.length > 0) {
    summary = lines[0];
  }

  cb(summary, keyPoints.slice(0, 3));
}
