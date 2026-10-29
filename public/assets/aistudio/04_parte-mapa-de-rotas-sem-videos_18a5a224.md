# Norma Jurídica — PARTE 4 — Mapa de rotas (sem `/videos`)

| Rota | Função | Revalidação |
|---|---|---|
| `/` | Home (cliente) com busca `?q=` e redirecionamento de `?article=` → `/noticia/[slug]` | dinâmica |
| `/noticia` | Lista das últimas notícias | ISR 60 s |
| `/noticia/[slug]` | Matéria completa (`generateMetadata`, JSON-LD `NewsArticle`) | ISR 60 s |
| `/categoria` | Guia de editorias agrupado (tema / região) com contagem | ISR |
| `/categoria/[slug]` | Notícias da editoria | ISR 60 s |
| `/pagina` · `/pagina/[slug]` | Índice e páginas institucionais | estática |
| `/contato` · `/privacidade` · `/termos` · `/cookies` | Atendimento e páginas legais | estática |
| `/[...slug]` | *Catch-all* que resolve, em ordem, **categoria → matéria → página institucional**, senão 404 | ISR 60 s |
| `/sitemap.xml` + 4 sub-sitemaps | SEO (Parte 9) | dinâmica |
| `/api/*` | Parte 6 | dinâmica |
| `/videos` | **inexistente** → `not-found` | — |

Slugs de categoria são gerados por `categorySlugify` (sem acentos, `ç→c`, `&→e`, minúsculas, hífens). As URLs com acento codificado (ex.: `/categoria/justi%C3%A7a`, `/categoria/pop-%26-arte`) devem **continuar resolvendo** (por `normalizeCategoryText`/catch-all) e redirecionar com `308` para o slug limpo canônico.
