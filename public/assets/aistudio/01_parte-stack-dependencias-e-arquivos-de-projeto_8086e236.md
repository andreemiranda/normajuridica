# Norma Jurídica — PARTE 1 — Stack, dependências e arquivos de projeto

**Framework e linguagem:** Next.js 15 (App Router) · React 19 · TypeScript 5.9 (strict, `ignoreBuildErrors: false`) · Node 20.

**Dependências (mesmas versões do projeto de referência):**

- `next ^15.4.9`, `react ^19.2.1`, `react-dom ^19.2.1`
- `tailwindcss 4.1.11`, `@tailwindcss/postcss 4.1.11`, `@tailwindcss/typography ^0.5.19`, `tw-animate-css ^1.4.0`, `postcss ^8.5.6`, `autoprefixer ^10.4.21`
- `lucide-react ^0.553.0` (ícones), `motion ^12.23.24` (animações; `transpilePackages: ['motion']`)
- `clsx ^2.1.1`, `tailwind-merge ^3.3.1`, `class-variance-authority ^0.7.1`, `@hookform/resolvers ^5.2.1`
- `rss-parser ^3.13.0`, `nodemailer ^10.1.1` (+ `@types/nodemailer`), `@google/genai ^2.4.0` (uso **somente servidor**, reservado a `GEMINI_API_KEY`)
- dev: `eslint 9.39.1`, `eslint-config-next 16.0.8`, `firebase-tools ^15`, `typescript 5.9.3`, `@types/node ^20`, `@types/react ^19`, `@types/react-dom ^19`

**Scripts:** `dev` (`next dev -p 3000`), `build` (`NODE_ENV=production next build`), `start`, `start:standalone`, `start:dedicated`, `start:pm2`, `lint`, `clean`.

**Fontes tipográficas:** usar `next/font/google` (já faz parte do Next; não é dependência nova) — ver Parte 3.

**Arquivos de projeto a recriar** (com a marca trocada):

- `next.config.ts`: `reactStrictMode`; `images.remotePatterns` liberando `https` e `http` com `hostname: '**'`; `output: 'standalone'` + `outputFileTracingRoot` quando `DOCKER_BUILD` ou `STANDALONE_BUILD` = `'true'`; `transpilePackages: ['motion']`; cabeçalhos globais `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer-when-downgrade`; cache `public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400` para `/(sitemap.*\.xml|robots\.txt|ads\.txt)`; ajuste de `watchOptions` quando `DISABLE_HMR=true`.
- `tsconfig.json` com alias `@/*`, `postcss.config.mjs` (`@tailwindcss/postcss`), `eslint.config.mjs`, `.eslintrc.json`, `.gitignore`, `.dockerignore`, `next-env.d.ts`.
- `Dockerfile` multi-stage (deps → builder → runner, `node:20-alpine`, usuário não-root `nextjs`, `DOCKER_BUILD=true`, `HEALTHCHECK` com `curl -f http://localhost:3000/api/health`).
- `docker-compose.yml` (serviço `norma-juridica`, container `norma_juridica_app`, porta 3000, healthcheck; `NEXT_PUBLIC_SITE_URL`/`SITE_DOMAIN` vindos de variável de ambiente, **sem URL fixa**).
- `ecosystem.config.js` (PM2, `name: 'norma-juridica'`, `instances: 'max'`, `exec_mode: 'cluster'`, `max_memory_restart: '1G'`).
- `vercel.json` (`framework: nextjs`, `cleanUrls: true`, `regions: ["gru1"]`, mesmos headers) e `netlify.toml` (plugin `@netlify/plugin-nextjs`, mesmos headers; `Content-Type` e cache para `ads.txt` e `robots.txt`).
- `metadata.json`: `name: "Norma Jurídica"`, descrição jurídica/jornalística equivalente à original, `majorCapabilities: ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]`.
- `.env.example` com **todas** as variáveis da Parte 11, sem valores.

**Estrutura de pastas:**

```
app/
  layout.tsx · page.tsx · globals.css · manifest.ts · not-found.tsx · robots.ts
  [...slug]/page.tsx
  noticia/page.tsx · noticia/[slug]/page.tsx
  categoria/page.tsx · categoria/[slug]/page.tsx
  pagina/page.tsx · pagina/[slug]/page.tsx
  contato/page.tsx · privacidade/page.tsx · termos/page.tsx · cookies/page.tsx
  sitemap.xml/route.ts · sitemap-posts.xml/route.ts · sitemap-categories.xml/route.ts
  sitemap-pages.xml/route.ts · sitemap-images.xml/route.ts
  api/ audio · categories · contact · health · news · news/article · news/ai-summary · revalidate · sync · weather
components/
  AdSenseBanner · ArticlePageClient · BreakingTicker · CategoryTabs · CookieConsentBanner
  FeaturedNews · Footer · Header · NewsCard · OptimizedImage · WeatherCard
hooks/use-mobile.ts
lib/ accessibility · active-sources.json · api-config · article-extractor · feeds · news-fetcher
     protocol · sanitizer · security · seed-news · seo · site-config · sitemap-viewer · slug
     sources · types · utils · wp
services/wordpress.ts
public/ ads.txt · favicon.svg · icon.svg · icon-192.png · icon-512.png · apple-touch-icon.png · cover.svg · cover.png · og-image.png
```

> Observação: **não** existe `app/videos/`.

**Checklist da Parte 1:** `npm install` e `npm run build` concluem sem erros de tipo.
