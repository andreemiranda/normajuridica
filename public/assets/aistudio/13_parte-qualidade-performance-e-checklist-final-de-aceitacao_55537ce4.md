# Norma Jurídica — PARTE 13 — Qualidade, performance e checklist final de aceitação

**Performance:** `next/image` com `sizes`, `priority` só no destaque, fontes `display: swap`, ISR de 60 s nas páginas de leitura, `prefetch` nos links do ticker, nenhum *layout shift* nos anúncios (reservar altura mínima), JS do cliente restrito às ilhas interativas.

**Aceite final (tudo deve estar verdadeiro):**

1. `npm run lint` e `npm run build` sem erros.
2. Tema visual **100% azul**; zero classes `red-*`; modo escuro consistente.
3. Nenhuma ocorrência de "Portal News", "portalnews" (exceto o e-mail institucional preservado), "G1", "Globo" ou "/videos".
4. Rotas da Parte 4 funcionam; `/videos` → 404; `/categoria/justi%C3%A7a` → 308 para `/categoria/justica`.
5. Home carrega notícias reais (ou *seed*), busca, salvos, atualizar, grade/compacto, clima, ticker e "Mais Lidas".
6. Matéria: áudio, resumo por IA, copiar link, compartilhar, relacionadas e JSON-LD válidos.
7. Contato gera protocolo de 13 dígitos (sem zero, sem repetição adjacente) com e sem SMTP.
8. `/sitemap.xml` + 4 sub-sitemaps válidos (XML para robôs, HTML para humanos), `robots.txt` com domínio dinâmico, `ads.txt` correto.
9. Responsivo sem rolagem horizontal em 360, 768, 1024, 1440 px; navegação por teclado e contraste AA.
10. Nenhum segredo no repositório.
