import { NextRequest, NextResponse } from 'next/server';
import { sanitizePublicData, checkRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
  return NextResponse.json(
    sanitizePublicData({
      enabled: hasElevenLabs,
      provider: hasElevenLabs ? 'elevenlabs' : 'browser',
    })
  );
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'anonymous';
    const rateLimit = checkRateLimit(`audio:${clientIp}`, 15, 5 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        sanitizePublicData({ enabled: false, fallback: 'web-speech', error: 'Limite de requisições atingido. Utilizando síntese nativa.' }),
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = (body.text || '').slice(0, 4000).trim();

    if (!text) {
      return NextResponse.json(
        sanitizePublicData({ error: 'Texto para síntese de áudio é obrigatório.' }),
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const baseUrl = process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io/v1';

    if (!apiKey) {
      return NextResponse.json(
        sanitizePublicData({
          enabled: false,
          fallback: 'web-speech',
          message: 'ElevenLabs não configurado. Utilizando síntese nativa do navegador.',
        })
      );
    }

    const res = await fetch(`${baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
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
        sanitizePublicData({ enabled: false, fallback: 'web-speech' })
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
      sanitizePublicData({ enabled: false, fallback: 'web-speech' })
    );
  }
}
