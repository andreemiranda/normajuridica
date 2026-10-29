# Norma Jurídica — PARTE 6 — APIs internas (`app/api`)

Todas `dynamic = 'force-dynamic'` e com resposta passando por `sanitizePublicData`.

| Endpoint | Método | Entrada | Saída / regras |
|---|---|---|---|
| `/api/news` | GET | `category`, `sourceId`, `q`, `refresh=true` | `{ items, source:'upstream', total, isRealTime:true, updatedAt }`; erro 500 → `{ error, items: [] }` |
| `/api/news/article` | GET | `slug`/`id`, `url`/`link`, `title`, `category`, `text` | busca o texto integral (até 4500 caracteres) na URL de origem; se <300 caracteres usa `ensureCompleteArticleText`; sempre `success:true` com `contentHtml` |
| `/api/news/ai-summary` | GET/POST | POST: `{ title, summary, link }` | GET informa provedor (`custom` ou `pollinations`). POST: valida título (400), cache em memória 30 min por título; **1º** endpoint customizado (`AI_SUMMARY_*`, rota `/chat/completions`, `temperature 0.2`), **2º** Pollinations.AI (POST, *timeout* 9 s, intervalo mínimo de 1,2 s entre chamadas, 1 único parágrafo), **3º** Pollinations via GET (8 s), **4º** resumo extrativo determinístico (3 primeiras frases). O *prompt* de sistema diz "editor sênior de jornalismo do **Norma Jurídica**". Devolve também `keyPoints` para a interface |
| `/api/weather` | GET | `q` (padrão `Brasilia`) | WeatherAPI (`/forecast.json`, 1 dia, `lang=pt`, cache 5 min); *fallback* para Brasília se a geolocalização falhar; devolve temperatura, sensação, umidade, condição, UV (Baixo <3, Moderado 3–5, Alto 6–7, Muito Alto ≥8) e previsão do dia; sem chave devolve *payload* padrão |
| `/api/audio` | GET/POST | POST: `{ text }` (≤4000) | GET `{ enabled, provider: 'elevenlabs'|'browser' }`. POST: ElevenLabs (`eleven_multilingual_v2`) retornando `audio/mpeg`; se não configurado, `{ enabled:false, fallback:'web-speech' }` |
| `/api/categories` | GET | — | `{ success, total, categories[{id,name,count,highlight,group}] }` mesclando contagem do upstream com o catálogo local |
| `/api/contact` | POST | `{ name, email, subject, message }` | Parte 8 |
| `/api/health` | GET | — | `{ status:'healthy', app:'Norma Jurídica', timestamp, uptimeSeconds, memoryRssMb, environment, platform }` (`vercel-serverless`/`netlify-serverless`/`dedicated-node`), `Cache-Control: no-store` |
| `/api/sync` | GET | `action=sync`, `format=json` | força revalidação e devolve *status*/latência/total/última matéria (JSON ou visão HTML) |
| `/api/revalidate` | GET/POST | `secret`, `all`, `path`, `slug`, `tag`, `type` | limpa cache e chama `revalidatePath`/`revalidateTag` (`news`, `posts`, `categories`, `pages`). **Exige `REVALIDATE_SECRET` configurado; sem valor padrão** (sem segredo definido → 401/503) |
