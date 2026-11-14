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

## ⚙️ Variáveis de Ambiente (`.env.local`)

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `NEWS_SQLITE_PATH` | `./data/news.db` | Caminho do arquivo SQLite (auto-detecta `/tmp/` em Serverless) |
| `NEWS_STORE_MAX_ITEMS` | `15000` | Capacidade máxima global de notícias no banco |
| `NEWS_STORE_MAX_PER_SOURCE` | `350` | Limite de matérias mantidas por fonte upstream |
| `NEWS_RETENTION_DAYS` | `90` | Dias para retenção e expiração de publicações |
| `NEWS_SYNC_INTERVAL_SECONDS`| `60` | Intervalo em segundos entre sincronizações de fundo |
| `NEWS_API_BASE_URL` | `https://news-sources-api.legislativemunicipal.workers.dev` | URL base da API de notícias |
| `API_KEY` | `""` | Chave de autenticação da API no ambiente do servidor (`NEWS_API_KEY` também aceita) |

---

## 🌐 Recomendações por Ambiente de Hospedagem

### 1. Docker / VPS / PM2 (Modo Recomendado)
- **Persistência total:** O arquivo SQLite reside no disco da máquina ou em volume montado (ex.: `./data`).
- **Performance máxima:** Consultas em milissegundos direto no arquivo local com WAL (*Write-Ahead Logging*).
- **Execução:**
```bash
docker run -p 3000:3000 -v $(pwd)/data:/app/data norma-juridica
```

### 2. Ambientes Serverless (Vercel, Netlify, AWS Lambda)
- O app detecta automaticamente o filesystem efêmero e direciona o SQLite para `/tmp/norma-juridica-news.db`.
- Para acervo distribuído permanente compartilhado entre múltiplas instâncias sem estado, recomenda-se plugar uma implementação Postgres na interface `INewsStore` (ex.: Supabase, Neon ou Cloud SQL).

### 3. Cloudflare Workers (`worker.js`, `wrangler.jsonc` e `wrangler.toml`)
- O portal suporta execução nativa na borda (Edge) com paridade de interface e rotas (`/`, `/categoria/[slug]`, `/noticia/[slug]`, `/contato`, `/pagina/[slug]`, `/api/*`, `sitemap*.xml`, `robots.txt` e Cron Trigger `scheduled`).
- **Deploy padrão no Workers (`name = "news"`):** o projeto publica automaticamente em `https://news.mirandinhacontabilidade.workers.dev`, sem `routes` ou `custom_domain` fixos (evitando erro `[code: 10082]`).
- **Modo Standalone Edge vs. Híbrido:** sem `ORIGIN_URL`, o Worker responde diretamente da borda consumindo `NEWS_API_BASE_URL` com Edge Cache e fallback automático. Se `ORIGIN_URL` apontar para um servidor Node.js externo (ex.: `https://origin-node.seudominio.com`), o Worker atua como proxy com proteção anti-loop (`x-nj-worker-hop`) e fallback para Edge Standalone em caso de erro `5xx`.
- **Segredos exclusivos no ambiente do Worker (nunca no repositório):**
```bash
npx wrangler secret put API_KEY
npx wrangler secret put NEWS_API_KEY
npx wrangler secret put WEATHER_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put REVALIDATE_SECRET
npx wrangler deploy
```

---

## 🧪 Como Testar o Rodízio e a Sincronização

### 1. Verificar Status do Armazenamento e Conexão
Acesse via navegador ou terminal:
```bash
curl -s "http://localhost:3000/api/sync"
```
Ou abra no navegador para ver o painel visual formatado:
`http://localhost:3000/api/sync?format=html`

### 2. Forçar Sincronização Imediata
Dispara a consulta às 77 fontes em segundo plano, faz upsert no SQLite e aciona revalidação:
```bash
curl -s "http://localhost:3000/api/sync?action=sync"
```

### 3. Testar Rodízio FIFO e Retenção (*Prune*)
Para testar a poda automática e rotação de capacidade configurada:
```bash
curl -s "http://localhost:3000/api/sync?action=prune"
```

### 4. Exportar Backup das Notícias em JSON
```bash
curl -s "http://localhost:3000/api/sync?action=export" > backup-noticias.json
```

---

## 💻 Como Rodar Localmente

1. Instale as dependências:
```bash
npm install
```

2. Configure as variáveis de ambiente baseadas no `.env.example`:
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
Telefone: (61) 9 9242-8022
