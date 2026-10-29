# Norma Jurídica — ANEXO C — Sitemaps e páginas (a partir das listas fornecidas, **sem `/videos`**)

**Sitemaps (`/sitemap.xml`):**

| Sitemap | changefreq | priority |
|---|---|---|
| `/sitemap-posts.xml` | hourly | 1.0 |
| `/sitemap-categories.xml` | hourly | 0.9 |
| `/sitemap-pages.xml` | weekly | 0.8 |
| `/sitemap-images.xml` | hourly | 0.8 |

**`/sitemap-pages.xml`:**

| Caminho | changefreq | priority | Título (visualizador) |
|---|---|---|---|
| `/` | always | 1.0 | Página Inicial |
| `/noticia` | always | 0.9 | Sala de Imprensa & Últimas Notícias |
| `/categoria` | hourly | 0.9 | Guia Editorial & Editorias |
| `/pagina` | weekly | 0.8 | Índice de Páginas Institucionais |
| `/pagina/cadastro-certo` | monthly | 0.8 | Cadastro Certo e Alertas |
| `/pagina/sobre-a-prefeitura` | monthly | 0.8 | Sobre a Prefeitura e Administração |
| `/pagina/transparencia` | monthly | 0.8 | Transparência e Governança |
| `/pagina/ouvidoria` | monthly | 0.8 | Ouvidoria Geral e Atendimento |
| `/pagina/iptu` | monthly | 0.8 | IPTU e Serviços Fazendários |
| `/pagina/linha-editorial` | monthly | 0.7 | Linha Editorial e Princípios Éticos |
| `/contato` | monthly | 0.8 | Contato da Redação e Atendimento |
| `/privacidade` | monthly | 0.7 | Política de Privacidade (LGPD) |
| `/termos` | monthly | 0.7 | Termos e Condições de Uso |
| `/cookies` | monthly | 0.7 | Política e Gestão de Cookies |

> Removido em relação ao original: `/videos` (daily, 0.8, "TV … & Vídeos").

**`/sitemap-categories.xml`:** uma entrada por categoria do Anexo A, `changefreq: hourly`, `priority: 0.8`, usando o **slug limpo** (`/categoria/{slug}`), com `lastmod` = momento da geração. As URLs de lista fornecidas (ex.: `/categoria/justi%C3%A7a`, `/categoria/pop-%26-arte`, `/categoria/goi%C3%A1s`, `/categoria/campinas-e-regi%C3%A3o`…) correspondem às mesmas editorias na forma acentuada/codificada: **devem continuar abrindo a mesma página** (redirecionando com 308 para o slug limpo).

**`/sitemap-posts.xml`:** uma `<url>` por matéria (`/noticia/{slug}`), com `lastmod` = data de publicação, `changefreq` e `priority` do original. **`/sitemap-images.xml`:** uma `<url>` por matéria com `<image:image>` (`image:loc`, `image:title`, `image:caption`) escapando XML.
