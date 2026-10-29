# Norma Jurídica — PARTE 10 — Acessibilidade, tema, armazenamento local e LGPD

- **Tema:** classe `dark` em `<html>` (`@custom-variant dark (&:where(.dark, .dark *))`). Claro é o padrão; escolha guardada em `sessionStorage` e espelhada no `localStorage`; evento `CustomEvent` de sincronização entre componentes. Chaves renomeadas com prefixo `nj_`: `nj_theme_session`, `nj_theme`, `nj_font_size`, `nj_news_bookmarks`, `nj_cookie_consent`.
- **Fonte:** três níveis (`normal`, `large`, `xlarge`) via `data-font-size` no `<html>`, persistidos e anunciados por evento.
- **Salvos ("Minha Lista"):** lista de `id`s no `localStorage`, compartilhada entre Home, Header e página de matéria.
- **Cookies/LGPD:** banner de consentimento (essenciais / análise / publicidade), páginas `/privacidade` e `/cookies` e assunto "Privacidade e Dados Pessoais (LGPD)" no contato.
- **Leitura em áudio:** ElevenLabs (opcional) ou síntese do navegador; sempre com controle de pausa e velocidade.
- Teclado e leitores de tela: ordem de foco lógica, `aria-live="polite"` para "atualizado às…" e erros, botões com `aria-pressed` (salvar, tema).
