# Norma Jurídica — PARTE 3 — Design system (azul · elegante · moderno · responsivo)

**3.1 Paleta (Tailwind v4, em `@theme` no `globals.css`):**

| Token | Valor | Uso |
|---|---|---|
| `brand-50` | `#eff6ff` | fundos suaves, hover de chips |
| `brand-100` | `#dbeafe` | anéis, badges claros |
| `brand-200/300` | `#bfdbfe` / `#93c5fd` | bordas ativas, ilustrações |
| `brand-400` | `#60a5fa` | links e acentos no modo escuro |
| `brand-500` | `#3b82f6` | foco (`focus-visible` ring) |
| `brand-600` | `#2563eb` | botões secundários, ícones |
| **`brand-700`** | **`#1d4ed8`** | **cor principal** (botões, chapéus, links, logotipo) |
| `brand-800` | `#1e40af` | hover, ticker, barra ativa |
| `brand-900/950` | `#1e3a8a` / `#172554` | ticker no modo escuro, footer destaque, degradês |

Neutros: `slate`/`zinc` (superfícies claras `white`/`slate-50`; escuras `zinc-950`/`zinc-900`; bordas `slate-200`/`zinc-800`). Acento de plantão: `amber-300/400`. Estados: `emerald` (atualizado/online), `rose` apenas para erros. **Nenhuma classe `red-*` pode sobrar** (troque todas por `brand-*`).

Aplicações obrigatórias da cor: `themeColor` (viewport) e `theme_color` do manifest = `#1d4ed8`; `background_color` do manifest `#121316`; barra de rolagem (`scrollbar-color`, `::-webkit-scrollbar-thumb`) = `#1d4ed8`, hover `#1e40af`, active `#1e3a8a`, trilho `#f4f4f5` / escuro `#18181b`.

**3.2 Tipografia:** `Inter` (UI e manchetes, pesos 400–900, `display: swap`) + `Source Serif 4` (corpo das matérias, `prose` com `leading-8`), ambas via `next/font/google` com *fallback* de sistema. Escala: manchete do destaque `text-3xl → lg:text-5xl font-black tracking-tight leading-[1.1]`; manchete de card `text-base → text-lg font-bold leading-snug`; chapéu de categoria `text-[11px] font-extrabold uppercase tracking-wider text-brand-700`; metadados `text-xs text-slate-500`. Manter `font-feature-settings: "rlig" 1, "calt" 1` e as três escalas de acessibilidade: `html[data-font-size]` = `16px` / `18.5px` / `21px`.

**3.3 Linguagem visual (estilo de portal de grande audiência, sem citar marca):**

- **Chapéu** (kicker) de categoria em azul, maiúsculo, **acima** da manchete, em todos os cards.
- Cards **orientados à imagem** (16:9, `rounded-2xl`, `overflow-hidden`), manchete em até 3 linhas (`line-clamp`), metadados (tempo relativo + autor) em cinza.
- **Destaque principal** grande com degradê `from-black/80 via-black/30 to-transparent` sobre a imagem, selo "Destaque Principal" e 2 destaques laterais.
- Divisórias finas (`border-slate-200`), muito respiro (`gap-5/6`, `py-8`), sombras suaves (`shadow-sm` → `hover:shadow-xl`), contêiner `max-w-7xl`.
- **Ranking "Mais Lidas • Em Alta"** com numerais grandes em azul.
- Menu de editorias **fixo (`sticky`)** com sublinhado azul animado na aba ativa.
- **Ticker "Última Hora"** com selo `brand-900` e marquee contínuo.

**3.4 Movimento (usar `motion`):** *fade/slide-up* de 8–12 px na entrada dos cards (escalonado, 40 ms), `hover:-translate-y-0.5` com sombra, indicador da aba ativa com `layoutId`, abertura suave do banner de cookies. Respeitar `@media (prefers-reduced-motion: reduce)` (desligar marquee e transições). Manter a animação `marquee` (85 s, pausa no hover) e `.no-scrollbar`.

**3.5 Responsividade (mobile-first, mínimo 360 px):**

| Faixa | Comportamento |
|---|---|
| `< 640` (mobile) | 1 coluna; barra utilitária empilhada; busca ocupa 100%; menu de editorias em rolagem horizontal sem barra; sidebar desce para depois da lista; alvos de toque ≥ 44 px; `safe-area-inset` no banner de cookies e no botão "voltar ao topo" |
| `640–1023` (tablet) | grade de 2 colunas; destaque + 2 laterais empilhados; clima ao lado do título |
| `≥ 1024` (desktop) | grade 12 colunas: conteúdo `col-span-8` + sidebar `col-span-4` *sticky* (`top-24`); destaque `lg:col-span-8` + laterais `lg:col-span-4` |
| `≥ 1536` | contêiner continua `max-w-7xl`, apenas mais respiro |

Imagens sempre com `sizes` corretos; sem rolagem horizontal da página em nenhuma largura.

**3.6 Acessibilidade visual:** contraste AA, `focus-visible:ring-2 ring-brand-500 ring-offset-2`, link "Pular para o conteúdo" no topo, `aria-label` em todos os botões de ícone, landmarks (`header`, `nav`, `main`, `aside`, `footer`).

**Checklist da Parte 3:** captura em 360, 768, 1024 e 1440 px nos modos claro e escuro; zero resquício de vermelho.
