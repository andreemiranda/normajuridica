# Norma Jurídica — PARTE 14 — Fonte única de notícias (news-sources-api)

**Fonte das notícias:**
```
NEWS_API_BASE_URL="https://news-sources-api.vercel.app"
NEWS_API_FALLBACK_URL="https://news-sources-api.vercel.app"
NEWS_API_KEY="[escrever no código]"
```
Esta parte altera a Parte 5 (`api-config.ts`, `news-fetcher.ts`) e a regra 7 da Parte 0 somente para a `NEWS_API_KEY`.

**1. Configuração (`lib/api-config.ts`, somente servidor)**
- Ler `NEWS_API_BASE_URL` e `NEWS_API_FALLBACK_URL`. Se vazias, usar `https://news-sources-api.vercel.app` nas duas.
- Chave: ler `process.env.NEWS_API_KEY`; se vazia, usar a constante única `NEWS_API_KEY_INLINE` (deixar `''`, para eu colar a chave). Nunca usar prefixo `NEXT_PUBLIC_`, nunca devolver a chave ao cliente e manter `sanitizePublicData`.
- Remover a regra "se contiver netlify, inverter". Enviar `Authorization: Bearer` e `x-api-key` quando houver chave.

**2. Formato da API**
- `GET /api/news` devolve as fontes (77 itens): `{ id, category, type: 'wp-api'|'rss', active, _links }`. Usar **todas** com `active: true`, em vez de só as 76 do Anexo B (a `5183624795316`, de Esporte, é nova). Mesclar com o catálogo local, e o upstream prevalece.
- `GET /api/news/{sourceId}?page=N&limit=N` devolve `items[]` e `meta{ totalItems, totalPages, currentPage }`. Cada item tem `{ id, title, slug, alt, description, content, pubDate, author, imageUrl, _links }`.
- `GET /api/images/{sourceId}` devolve o registro de imagens da fonte. Ler de forma tolerante, aceitando array ou objeto, e casar com a matéria por `id`, `slug`, `title` ou `alt`.
- `GET /api/categories`, `/api/stats`.

**3. Mapeamento `item → NewsItem`**
- `category` vem da fonte (`category` do `/api/news`), pois o item não traz categoria.
- `summary` = `description` (remover `…` final); `contentHtml` = `content` (parágrafos separados por `\n\n` → `<p>`); `imageCaption` = `alt`; `isoDate` = `pubDate`.
- `author` numérico (ex.: `"121"`) ou vazio → "Norma Jurídica". `source: 'Norma Jurídica'`.
- Sanitizar `title`, `description` e `content`: aplicar `BLOCKED_BRAND_TERMS` e remover o termo "Portal News" que aparece no texto upstream (ex.: "resultado de Portal News").

**4. Todas as categorias, todas as fontes**
- Home ("todas"): buscar **todas as fontes ativas**, `limit=10` e `page=1` por fonte, em *pool* de 8 requisições simultâneas, *timeout* de 4 s e fallback para `NEWS_API_FALLBACK_URL`. Falhas isoladas não derrubam a resposta (`Promise.allSettled`).
- Categoria: todas as fontes daquela categoria, com paginação (`page`, `limit` até 50) em `/api/news?category=&page=`.
- Todas as 54 categorias do Anexo A e todas as categorias retornadas por `/api/categories` devem existir em `/categoria`, no sitemap e no menu. Contagens vêm do upstream.
- Manter cache de 60 s, deduplicação por título, ordenação por data decrescente e seed como último recurso.

**5. Todas as imagens de cada matéria**
- Adicionar `images: string[]` (sem duplicatas, ordem: `imageUrl` → registro `/api/images/{id}` → `<img src>` e `<figure>` do `content` → `og:image` da URL de origem, se houver), e `imageUrl = images[0]`.
- Descartar URLs com `placeholder`, `data:image`, `pixel` ou `1x1`.
- Matéria sem nenhuma imagem: usar o *pool* da categoria e depois `/cover.png`.
- `ArticlePageClient`: imagem principal com legenda mais **galeria** (miniaturas clicáveis) quando `images.length > 1`. Incluir todas em `sitemap-images.xml` (um `<image:image>` por imagem) e `og:image`.
- Liberar os domínios das imagens (ex.: `opiniaogoias.com.br`) via `remotePatterns` `**`, como já existe.

**Checklist da Parte 14:** `/api/news` retorna matérias de todas as fontes ativas; `/categoria/saude` e `/categoria/goias` listam matérias reais; cada matéria exibe todas as suas imagens; a chave não aparece em nenhuma resposta; `npm run build` passa.