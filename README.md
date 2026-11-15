# Norma Jurídica

> A informação que move o Brasil — Portal de notícias com cobertura em tempo real de política, economia, justiça, educação, esportes, tecnologia e notícias dos estados brasileiros.

## 🚀 Tecnologias

- **Framework:** Next.js 15 (App Router)
- **Linguagem:** TypeScript 5.9 (Strict)
- **Banco de Dados Local:** SQLite via `better-sqlite3` (WAL mode, transações ACID, índices otimizados)
- **Estilização:** Tailwind CSS v4 & Lucide React
- **Animações:** Motion
- **SEO & Social:** OpenGraph, Twitter Cards, Schema.org (JSON-LD), RSS & Sitemaps XML

---

## 🗄️ Arquitetura de Armazenamento Local Persistente

O portal utiliza uma camada de persistência local baseada em **SQLite (`better-sqlite3`)** com abstração de interface (`INewsStore` em `lib/news-store.ts`), reduzindo drasticamente as chamadas à API upstream:

1. **Leitura Direta do Banco:** Todas as páginas (Home, Editorias, Detalhes de Notícia, Sitemaps XML e `/api/news`) consultam primeiro o SQLite local. Respostas sub-milissegundo sem dependência de rede externa.
2. **Resiliência a Quedas:** Caso a API externa fique fora do ar ou lenta, o portal continua funcionando 100% normalmente, servindo todo o acervo previamente armazenado.
3. **Abstração Desacoplada (`INewsStore`):** Permite trocar o backend de dados para PostgreSQL (ou Cloud SQL / Supabase) sem alterar nenhuma linha dos componentes ou rotas do Next.js.
4. **Sincronizador em Segundo Plano (`lib/news-sync.ts`):** Executa em background a cada intervalo configurável (`NEWS_SYNC_INTERVAL_SECONDS`), realizando *upsert* inteligente (apenas grava novos ou atualizados, descartando inalterados), com URLs primária e fallback, retry com backoff exponencial e trava de concorrência (*mutex lock*).
5. **Rodízio FIFO e Retenção Automática:**
   - **`NEWS_STORE_MAX_ITEMS` (padrão 15000):** Limite global de matérias. Ao ultrapassar, remove as mais antigas por data de publicação, garantindo representatividade das 77 fontes.
   - **`NEWS_STORE_MAX_PER_SOURCE` (padrão 350):** Limite de notícias por fonte individual.
   - **`NEWS_RETENTION_DAYS` (padrão 90):** Expiração temporal de publicações antigas.

---

## ⚙️ Configuração de Ambiente e Segredos

Todas as credenciais e chaves de integração devem ser configuradas **exclusivamente** no gerenciador de segredos da plataforma (ou em `.env.local` / `.dev.vars` não versionados) — **nunca** em arquivos `.md`, código-fonte ou variáveis `NEXT_PUBLIC_*`.

| Categoria | Variáveis Públicas | Segredos (Somente Servidor / Runtime) |
| :--- | :--- | :--- |
| **Portal / SEO** | `APP_URL`, `SITE_DOMAIN`, `NEXT_PUBLIC_SITE_URL` | — |
| **Banco Local (SQLite)** | `NEWS_SQLITE_PATH`, `NEWS_STORE_MAX_ITEMS`, `NEWS_STORE_MAX_PER_SOURCE`, `NEWS_RETENTION_DAYS`, `NEWS_SYNC_INTERVAL_SECONDS` | — |
| **Integração Upstream** | `NEWS_API_BASE_URL` | Chaves de autenticação configuradas exclusivamente no cofre de segredos |
| **Segurança & Cron** | — | Segredo administrativo (`REVALIDATE_SECRET` / `CRON_SECRET`) obrigatório para ações restritas |
| **Serviços Opcionais** | IDs públicos de exibição | Chaves de IA, Áudio, Clima, SMTP e Webhooks configuradas apenas no servidor |

---

## 🌐 Ambientes de Hospedagem

### 1. Docker / VPS / PM2 (Modo Recomendado)
- **Persistência total:** O arquivo SQLite reside em volume montado (ex.: `./data`).
- **Execução:**
```bash
docker run -p 3000:3000 --env-file .env.local -v $(pwd)/data:/app/data norma-juridica
```

### 2. Ambientes Serverless (Vercel, Netlify, AWS Lambda)
- O app detecta automaticamente o filesystem efêmero e direciona o SQLite para armazenamento temporário compatível.

### 3. Cloudflare Workers (`worker.js`, `wrangler.jsonc` e `wrangler.toml`)
- O portal suporta execução nativa na borda (Edge) com paridade de interface e rotas.
- **Segredos no Cloudflare:** cadastre todas as chaves sensíveis exclusivamente via CLI (`npx wrangler secret put <NOME_DO_SEGREDO>`) ou no painel criptografado de *Variables and Secrets* (nunca em `wrangler.jsonc`, `wrangler.toml` ou arquivos Markdown).

---

## 🔐 Práticas de Segurança Implementadas

- **Zero segredos no repositório:** `.gitignore` bloqueia `.env*`, `.dev.vars*`, chaves privadas, certificados e backups locais.
- **Autenticação obrigatória em rotas administrativas:** ações de sincronização forçada, poda (`prune`), exportação e revalidação exigem segredo válido via cabeçalho `Authorization: Bearer <TOKEN>` com comparação em tempo constante.
- **Sanitização e proteção contra vazamentos:** todas as respostas públicas passam por `sanitizePublicData`, bloqueando chaves, tokens e parâmetros sensíveis em URLs.
- **Cabeçalhos de segurança máxima:** `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` e `X-Robots-Tag: noindex, nofollow, noarchive` em `/api/*`.
- **Proteção contra SSRF e XSS:** validação estrita de URLs externas (bloqueio de IPs privados, loopback e metadados em nuvem), rate limiting deslizante e sanitização completa de HTML.

---

## 💻 Como Rodar Localmente

1. Instale as dependências:
```bash
npm install
```

2. Crie seu arquivo local a partir do modelo (não versionado):
```bash
cp .env.example .env.local
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```
Acesse em: `http://localhost:3000`

---

## 📄 Licença e Direitos Autorais

Todos os direitos reservados a **Norma Jurídica**.
Sede e foro: Brasília - DF.
