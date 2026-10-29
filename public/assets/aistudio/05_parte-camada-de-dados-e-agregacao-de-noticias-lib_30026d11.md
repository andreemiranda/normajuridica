# Norma Jurídica — PARTE 5 — Camada de dados e agregação de notícias (`lib/`)

**`types.ts`:** `NewsItem` (`id, slug, title, link, pubDate, isoDate?, timeAgo, category, categoryId, source, summary, contentHtml?, imageUrl?, imageCaption?, author?, originalCategory?, isBookmarked?`), `FeedSource`, `CategoryInfo` (`id, name, slug?, count?, highlight?, group?: 'nacional'|'regiao'|'tema'|'especial'`), `NewsApiSourceItem` (`id, endpoint, category, site, type?: 'wp-api'|'rss', name?`), `WeatherInfo`.

**`api-config.ts`:** `baseUrl` primária e `fallbackUrl` vindas de `NEWS_API_BASE_URL`/`NEWS_API_FALLBACK_URL`; padrões `https://news-sources-api.vercel.app` (primária) e `https://api-news-media.netlify.app` (fallback). Se a base configurada contiver "netlify", inverter (priorizar a estável e usar a netlify como fallback). `apiKey` **somente** de `NEWS_API_KEY` (sem valor padrão). Endpoints: `/api/news`, `/api/news/category/:cat`, `/api/images`, `/api/images/:id`, `/api/news/:id`, `/api/categories`, `/api/types`, `/api/stats`, `/api/openapi.json`. Enviar `Authorization: Bearer` e `x-api-key` quando houver chave.

**`sources.ts` + `active-sources.json`:** catálogo de **76 fontes** (id numérico → categoria; ver Anexo B), `ALL_CATEGORIES` (Anexo A), e as funções `normalizeCategoryText`, `resolveCategoryDisplayName`, `getSourcesByCategory` (com os mapeamentos semânticos: *política* inclui as fontes `8281449136684`, `1144428532544`, `9482399189391` e categorias que contenham "gerais"/"justiça"; *saúde* inclui `8346116142997`, `9886348421411`, `1144428532544`; *cultura/pop/arte* inclui `8833539123215`; *esporte* inclui Palmeiras e Autoesporte), `getSourceById`. `feeds.ts` deriva `DEFAULT_FEEDS` do catálogo.

**`news-fetcher.ts` — comportamento exato:**

1. Cache em memória por chave `categoria_fonte_consulta`, **TTL 60 s**; `clearNewsCache()` limpa cache e índice.
2. Fonte "todas" usa `DEFAULT_ALL_SOURCE_IDS` (Anexo B); categoria específica usa `getSourcesByCategory`; sem fontes → primeiras 10.
3. Para cada fonte, busca **em paralelo** `/api/news/:id` e `/api/images/:id` (`Promise.allSettled`), `fetch` com *timeout* de 4 s, `next: { revalidate: 60, tags: ['news','posts'] }`, tentando primeiro a URL primária e depois a de *fallback*.
4. Para cada item: descartar posts de "chamada de vídeo" (`isForbiddenVideoPost`), título inválido (<5 caracteres); escolher o campo de texto mais completo entre `content:encoded`, `content`, `description`, `fullText`, `summary`, `raw.*`; resumo = primeiro parágrafo (≤260 caracteres, cortando em ponto ou espaço, sem marcadores de truncamento); `contentHtml` completo via `ensureCompleteArticleText`.
5. **Garantia de imagem em 100% das matérias:** procurar em `imageUrl`, `mediaUrl`, `url` com extensão de imagem, `enclosure`, registro de `/api/images`, tags `<img>` no conteúdo, `media:content`; se faltar, emprestar do *pool* da própria categoria e, por fim, do *pool* global. Rejeitar URLs com `placeholder`, `data:image`, `pixel`, `1x1`.
6. `slug = slugify(título, id)` (≤85 caracteres, sem acentos); `id` = slug.
7. **Autor:** remover "por", marcas/colunas de terceiros (lista em `BLOCKED_BRAND_TERMS`), e se ficar vazio, curto, numérico ou `admin|redacao` → **"Norma Jurídica"**. `source: 'Norma Jurídica'`.
8. **Mapeamento editorial final:** fonte `8281449136684` → Política; Palmeiras/Autoesporte → Esporte; Finanças → Economia; Pop & Arte → Cultura.
9. `imageCaption`: `Registro jornalístico editorial • {categoria}`.
10. **`timeAgo`:** "Agora mesmo" (<1 min) · "Há N minuto(s)" · "Há N hora(s)" · "Ontem" (24–48 h) · `dd/mm/aaaa` (>48 h).
11. **Deduplicar por título** (minúsculo, sem espaços nas pontas); aplicar busca textual `searchQuery` (título, resumo, categoria); **ordenar por data decrescente**; se não restar nenhuma matéria, usar `getEditorialSeedNews()` (filtrada pela categoria pedida, ou todas as sementes se nenhuma casar).
12. Índice O(1) em memória por slug, id e slug-do-título. `getNewsItemBySlugOrId` resolve na ordem: índice exato → correspondência aproximada no índice → caches existentes → recarrega a home (`category: 'all'`) → `null`.

**`sanitizer.ts`:** `decodeHtmlEntities`, `cleanTitle`, `isForbiddenVideoPost` (mantém posts com YouTube; descarta "Vídeo:", "Assista…", "Ao vivo…", "Íntegra…", e textos <25 palavras que só convidam a assistir), `cleanFullNewsText`, `removeTruncationMarkers`.

**`article-extractor.ts`:** `extractArticleFromHtml`, `fetchFullArticleBody(url, limite)` e `ensureCompleteArticleText(texto, título, categoria)` (nunca devolve matéria vazia).

**`seed-news.ts`:** `getEditorialSeedNews()` com matérias editoriais de contingência (Política, Economia, Esporte, Justiça etc.), com `hoursAgo` crescente. **Reescrever em texto autoral** (sem citar veículos).

**Demais utilitários:** `slug.ts` (`slugify`, `categorySlugify`), `protocol.ts` (Parte 8), `security.ts` (`sanitizePublicData` recursivo: remove chaves cujo nome case com `api[_-]?key|secret|token|password|credential|auth[_-]?header|bearer|authorization|private[_-]?key|client[_-]?secret|gemini[_-]?key|elevenlabs|weatherapi|env[_-]?var` e mascara valores `AIza…`, `bn_…`, `sk-…`; `maskSecret`; `isEnvironmentSecure`), `accessibility.ts` (Parte 10), `seo.ts` (Parte 9), `sitemap-viewer.ts` (visualizador HTML dos sitemaps, Parte 9), `utils.ts` (`cn` = `twMerge(clsx())`), `wp.ts` e `services/wordpress.ts` (fachada `WordPressService`: `getPosts`, `getPostBySlug`, `getCategories`, `getPages` — 8 páginas: `cadastro-certo`, `sobre-a-prefeitura`, `transparencia`, `ouvidoria`, `iptu`, `sobre`, `linha-editorial`, `contato` — e `getStatus`), `hooks/use-mobile.ts` (breakpoint 768).
