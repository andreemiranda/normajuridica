# Norma Jurídica — PARTE 7 — Componentes de interface (`components/`)

**Header** (cliente). Duas faixas:
- *Barra utilitária* (`bg-zinc-950`): data por extenso em pt-BR (maiúscula inicial) · "Atualizado às HH:MM" com ponto pulsante verde · links **Editorias** (`/categoria`), **Institucional** (`/pagina`), **Contato** (`/contato`) com ícones `Layers`, `FileText`, `Mail` (**sem "TV & Vídeos"**) · controle de fonte **A- / A / A+ / A++** · botão **Modo Escuro/Modo Claro**.
- *Masthead*: logotipo NJ + wordmark + tagline · busca (`id="search-input"`, envia para `/?q=`) · botão **Atualizar** (`RotateCw`, gira enquanto carrega) · botão **Minha Lista** (`id="bookmarks-tab-button"`, contador de salvos). Em mobile a busca ocupa a largura toda e a barra utilitária empilha.

**CategoryTabs.** Menu horizontal fixo, sem barra de rolagem, com ícones Lucide: Todas as Notícias, Política, Economia, Justiça, Saúde, Educação, Cultura, Esporte, Tecnologia & Games, Gerais, Pará, Tocantins, Goiás, Santa Catarina, Mundo e **Minha Lista** (`favoritos`). Aba ativa em azul com sublinhado animado; navega para `/categoria/[slug]` (ou troca o estado quando recebe `setActiveCategory`). Exporta `POPULAR_CATEGORIES`.

**BreakingTicker.** Faixa "Última Hora" (selo `Zap` âmbar pulsando) com as 10 primeiras manchetes duplicadas em *marquee* contínuo; cada item mostra chapéu da categoria, título truncado e `timeAgo`, e leva a `/noticia/[slug]`. Não renderiza sem notícias.

**FeaturedNews.** Destaque principal (imagem grande com degradê, selo "Destaque Principal", chapéu, manchete, resumo, autor/tempo) + 2 destaques laterais ("Destaque"); título de seção "Destaques Especiais" em azul.

**NewsCard.** Variantes `grid` e `compact`; imagem `OptimizedImage`, chapéu, manchete (`line-clamp-2/3`), resumo (`line-clamp-3`), tempo, autor, botão **Salvar/Remover dos Salvos** (`Bookmark` preenchido quando salvo), ícone `Volume2` para ouvir; tamanho da fonte responde à escala de acessibilidade.

**OptimizedImage.** Envolve `next/image`; *fallback* para `/cover.png` em erro ou URL inválida (`placeholder`, `data:image`, `pixel`, `1x1`); `unoptimized` somente para hosts que bloqueiam o otimizador; suporta `fill`, `sizes`, `priority`.

**WeatherCard.** Cartão de clima com fundo em degradê conforme a condição (ensolarado âmbar, nublado azul-ardósia, chuva ciano/azul-escuro, tempestade roxo, noite índigo); tenta `navigator.geolocation` e depois consulta por IP/cidade; *fallback* `Brasilia`; mostra temperatura, sensação, umidade, condição e UV; esqueleto de carregamento e estado de erro.

**AdSenseBanner.** `<ins class="adsbygoogle">` renderizado só no cliente após montar, com `data-ad-client`, `data-ad-slot`, `data-ad-format`, `data-full-width-responsive="true"`; sem ID/slot devolve um `div` vazio de 1 px (não quebra layout). `push({})` com `try/catch`.

**Footer.** Anúncio do rodapé · logotipo NJ + tagline · texto institucional ("Cobertura jornalística independente, transparente e contínua sobre política, economia, justiça, educação, esportes, tecnologia e os estados brasileiros.") · **caixa de dados institucionais** (Responsável, Endereço, Telefone, Contato) · coluna **Editorias** (Todas as Notícias, Política, Economia, Justiça, Educação, Saúde, Esporte, Tecnologia & Games, Pará, Tocantins) · colunas **Institucional/Legal** reproduzindo os links do original (`/pagina/*`, `/contato`, `/privacidade`, `/termos`, `/cookies`, `/sitemap.xml`), **sem `/videos`** · botão **voltar ao topo** (aparece após 350 px de rolagem).

**CookieConsentBanner.** Aparece 600 ms após o carregamento se não houver consentimento; botões **Aceitar todos** e **Apenas essenciais**; grava `{ essential, analytics, advertising, timestamp }` no `localStorage`; link para `/cookies`; ícones `Cookie`/`Shield`/`Check`/`X`.

**ArticlePageClient.** Ver Parte 8 (página de matéria).
