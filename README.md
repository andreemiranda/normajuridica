# Norma Jurídica

> A informação que move o Brasil — Portal de notícias com cobertura em tempo real de política, economia, justiça, educação, esportes, tecnologia e notícias dos estados brasileiros.

## 🚀 Tecnologias

- **Framework:** Next.js 15 (App Router)
- **Linguagem:** TypeScript 5.9 (Strict)
- **Estilização:** Tailwind CSS v4 & Lucide React
- **Animações:** Motion
- **SEO & Social:** OpenGraph, Twitter Cards, Schema.org (JSON-LD), RSS & Sitemaps XML

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

## 📦 Produção e Deploy

### 1. Vercel
```bash
npm run build
```

### 2. Docker
```bash
docker build -t norma-juridica .
docker run -p 3000:3000 norma-juridica
```
Ou utilizando Docker Compose:
```bash
docker compose up -d
```

### 3. VPS com PM2
```bash
npm run build
npm run start:pm2
```

---

## 📄 Licença e Direitos Autorais

Todos os direitos reservados a **Norma Jurídica**.
Sede e foro: Brasília - DF.
Telefone: (61) 9 9242-8022
