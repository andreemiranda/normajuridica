# Norma Jurídica — PARTE 11 — Variáveis de ambiente e segurança

`.env.example` (todas **vazias**; nenhuma com `NEXT_PUBLIC_` exceto as públicas de URL e AdSense):

```
GEMINI_API_KEY=""
APP_URL="" · SITE_DOMAIN="" · NEXT_PUBLIC_SITE_URL=""
NEXT_PUBLIC_ADSENSE_ID="" · NEXT_PUBLIC_ADSENSE_SLOT_HEADER="" · NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR="" · NEXT_PUBLIC_ADSENSE_SLOT_FOOTER=""
GOOGLE_ADSENSE_CLIENT_ID="" · GOOGLE_ADSENSE_SLOT_HEADER="" · GOOGLE_ADSENSE_SLOT_SIDEBAR="" · GOOGLE_ADSENSE_SLOT_SIDEBAR_BOTTOM="" · GOOGLE_ADSENSE_SLOT_IN_ARTICLE="" · GOOGLE_ADSENSE_SLOT_FOOTER=""
NEWS_API_BASE_URL="" · NEWS_API_FALLBACK_URL="" · NEWS_API_KEY=""
WEATHER_API_KEY="" · WEATHER_API_BASE_URL="" · api_key_clima="" · api_url_clima_base=""
ELEVENLABS_API_KEY="" · ELEVENLABS_API_URL="" · ELEVENLABS_VOICE_ID=""
AI_SUMMARY_API_ENDPOINT="" · AI_SUMMARY_API_KEY="" · AI_SUMMARY_MODEL=""
SMTP_HOST="" · SMTP_PORT="" · SMTP_SECURE="" · SMTP_USER="" · SMTP_PASS="" · CONTACT_RECEIVER_EMAIL=""
REVALIDATE_SECRET=""
```

Regras: nenhuma credencial no código ou em *fallbacks*; toda resposta de API passa por `sanitizePublicData`; `/api/revalidate` e `/api/sync?action=sync` só funcionam com segredo válido; cabeçalhos de segurança da Parte 1; `Disallow: /api/` no robots.
