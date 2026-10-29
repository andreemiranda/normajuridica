# Norma Jurídica — PARTE 0 — Missão e regras absolutas

**Missão.** Construir um portal de notícias completo, chamado **Norma Jurídica**, que seja funcionalmente idêntico ao projeto de referência "Portal News" (mesmo ecossistema, bibliotecas, frameworks, APIs, categorias, páginas institucionais, SEO e dados institucionais), com **novo visual**: **azul, elegante, moderno e responsivo**, no estilo editorial dos grandes portais de notícias brasileiros (chapéu de categoria acima da manchete, cards centrados na imagem, destaque principal com sidebar, ranking "Mais lidas", menu de editorias fixo, ticker de plantão).

**Regras absolutas (valem para todas as partes):**

1. **Nome.** Todo "Portal News" / "PORTAL NEWS" / "portal-news" / "Portal News PA" passa a ser **Norma Jurídica** / **NORMA JURÍDICA** / `norma-juridica`. Isso inclui: UI, `<title>`, metadados, Open Graph, JSON-LD, manifest, e-mail de contato (template HTML), `/api/health`, `package.json` (`name`), `metadata.json`, Docker (imagem, container), PM2 (`name`), README, comentários e textos de fallback (autor padrão, `source`, legendas de imagem, etc.).
2. **Proibido citar G1 / Globo ou qualquer marca de portal concorrente** em componentes, páginas, textos, comentários, metadados, classes CSS, nomes de variáveis ou commits. Copie apenas o *estilo* (linguagem visual), nunca o nome. Observação: a lógica de servidor que **remove** marcas de terceiros dos campos `author`/texto vindos da API upstream deve continuar existindo, porém lendo os termos de uma constante (`BLOCKED_BRAND_TERMS` em `lib/sanitizer.ts`); nenhum desses termos pode aparecer em componentes, páginas ou metadados.
3. **Sem a página `/videos`.** Não criar `app/videos/`, e remover **toda** referência a ela: link "TV & Vídeos" do Header (e o ícone `Tv`), links em Footer, `not-found`, `[...slug]`, `sitemap-pages.xml`, lista de páginas, JSON-LD e textos. `/videos` deve responder com o 404 padrão do portal. (O filtro de servidor `isForbiddenVideoPost`, que descarta posts que são apenas chamadas de vídeo, **permanece**.)
4. **Mesma stack e mesmas funcionalidades** (Parte 1 e Parte 7–8). Não adicionar bibliotecas novas além das listadas.
5. **Mesmos dados institucionais** (Parte 2), apenas com o nome trocado.
6. **Idioma:** todo texto visível em **português do Brasil**; `<html lang="pt-BR">`.
7. **Segurança:** nenhuma chave, token ou segredo hardcoded, nem como *fallback* de `process.env`. Segredos só no servidor, nunca com prefixo `NEXT_PUBLIC_`.
8. **Modo claro é sempre o padrão** ao abrir o site; modo escuro só por escolha do leitor (por sessão).

**Checklist da Parte 0:** busca global por `Portal News`, `portalnews`, `g1`, `Globo`, `videos`, `Tv` retorna zero ocorrências indevidas.
