import { NextRequest, NextResponse } from 'next/server';
import { sanitizePublicData, checkRateLimit, assertSafeExternalUrl, getClientIp } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
  return NextResponse.json(
    sanitizePublicData({
      enabled: hasElevenLabs,
      provider: hasElevenLabs ? 'elevenlabs' : 'browser',
    }),
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req.headers);
    const rateLimit = checkRateLimit(`audio:${clientIp}`, 15, 5 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        sanitizePublicData({ enabled: false, fallback: 'web-speech', error: 'Limite de requisições atingido. Utilizando síntese nativa.' }),
        { status: 429, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength > 20 * 1024) {
      return NextResponse.json(
        sanitizePublicData({ error: 'Texto excede o tamanho máximo permitido.' }),
        { status: 413, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = (typeof body.text === 'string' ? body.text : '').slice(0, 4000).trim();

    if (!text) {
      return NextResponse.json(
        sanitizePublicData({ error: 'Texto para síntese de áudio é obrigatório.' }),
        { status: 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const rawVoiceId = (process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM').trim();
    const voiceId = /^[A-Za-z0-9_-]{5,64}$/.test(rawVoiceId) ? rawVoiceId : '21m00Tcm4TlvDq8ikWAM';
    const rawBaseUrl = (process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io/v1').replace(/\/+$/, '');
    const safeBaseUrl = assertSafeExternalUrl(rawBaseUrl, { requireHttps: true });

    if (!apiKey || !safeBaseUrl) {
      return NextResponse.json(
        sanitizePublicData({
          enabled: false,
          fallback: 'web-speech',
          message: 'ElevenLabs não configurado. Utilizando síntese nativa do navegador.',
        }),
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const res = await fetch(`${safeBaseUrl.toString().replace(/\/+$/, '')}/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        sanitizePublicData({ enabled: false, fallback: 'web-speech' }),
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json(
      sanitizePublicData({ enabled: false, fallback: 'web-speech' }),
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }
}
