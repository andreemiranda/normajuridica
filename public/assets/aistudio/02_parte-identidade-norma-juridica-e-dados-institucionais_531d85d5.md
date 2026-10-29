# Norma Jurídica — PARTE 2 — Identidade Norma Jurídica e dados institucionais

**`lib/site-config.ts`** (mesma estrutura do original):

```ts
export const SITE_CONFIG = {
  name: 'Norma Jurídica',
  shortName: 'Norma Jurídica',
  tagline: 'A informação que move o Brasil',
  description:
    'Portal de notícias com cobertura de política, economia, justiça, educação, esportes, tecnologia e notícias dos estados brasileiros.',
  institutional: {
    responsible: 'Norma Jurídica',
    address: 'Brasília-DF',
    phone: '(61) 9 9242-8022',
    email: 'contato@portalnews.com.br', // dado institucional mantido; ver nota abaixo
  },
  // domain, adsense{clientId, slots{header,sidebar,sidebarBottom,inArticle,footer}},
  // smtp{host,port,secure,user,pass,receiver}, aiSummary{endpoint,apiKey,model}
}
```

- `getBaseUrl(req?)` com a mesma ordem de resolução: `APP_URL` → `SITE_DOMAIN` → `NEXT_PUBLIC_SITE_URL` → cabeçalhos `x-forwarded-host`/`host` (ignorando localhost) → `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → `window.location.origin` → fallback canônico `https://normajuridica.com.br`. Sempre sem barra final e com `https://` quando ausente.
- AdSense: lê `NEXT_PUBLIC_ADSENSE_ID`/`GOOGLE_ADSENSE_CLIENT_ID` e os slots (`header`, `sidebar`, `sidebarBottom`, `inArticle`, `footer`) com as mesmas variantes de variável do original.
- SMTP: padrões `smtp.gmail.com`, porta `465`, `secure` verdadeiro se `SMTP_SECURE==='true'` ou porta 465; destinatário `CONTACT_RECEIVER_EMAIL` → `SMTP_USER` → e-mail institucional.
- Resumo por IA: `AI_SUMMARY_API_ENDPOINT`, `AI_SUMMARY_API_KEY`, `AI_SUMMARY_MODEL` (padrão `gpt-4o-mini`).
- **Nota sobre o e-mail:** o endereço acima é o dado institucional original, mantido por exigência de "mesmos dados". Centralize-o em `SITE_CONFIG.institutional.email` para que possa ser trocado em um único ponto (por exemplo, para `contato@normajuridica.com.br`).

**Logotipo (novo):** monograma **NJ** (branco, `font-black`) em quadrado arredondado (`rounded-2xl`) azul `brand-700` com anel `ring-4 ring-brand-100 dark:ring-brand-950/50`, seguido do wordmark **NORMA** (`text-slate-900 dark:text-zinc-100`) + **JURÍDICA** (`text-brand-700 dark:text-brand-400`), `font-black tracking-tighter`; tagline pequena abaixo. Variantes: masthead (48 px), footer (36 px), 404 e e-mail.

**Ícones e imagens sociais (azuis):** `favicon.svg` e `icon.svg` (`rect rx=128 fill=#1d4ed8` + texto "NJ" branco 900), `icon-192.png`, `icon-512.png` (também usado como *maskable*), `apple-touch-icon.png` (180), `cover.svg`/`cover.png` e `og-image.png` (1200×630, fundo degradê `brand-800 → brand-950`, logotipo e tagline). Gerar os PNG com um script descartável (não entra em `dependencies`).

**Páginas institucionais mantidas** (conteúdo idêntico, nome trocado; textos interpolam `SITE_CONFIG.institutional.*`): `sobre`, `linha-editorial`, `transparencia`, `ouvidoria`, `cadastro-certo`, `sobre-a-prefeitura`, `iptu`. Slug desconhecido gera página genérica "Apresentação Institucional" com título derivado do slug.

**Checklist da Parte 2:** rodapé, `/pagina/sobre`, `/pagina/transparencia`, `/pagina/ouvidoria` e e-mail de contato mostram Norma Jurídica, Brasília-DF e (61) 9 9242-8022.
