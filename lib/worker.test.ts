import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import worker, {
  resolveDnsAndCanonical,
  resolveSafeOriginUrl,
  resolveWorkerNewsApiConfig,
  buildWorkerNewsApiHeaders,
  sanitizePublicData,
  stripForcedAlignmentStyles,
  sanitizeArticleHtmlForWorker,
  renderWorkerSitemapHtml,
  splitTextForTts,
} from '../worker.js';

function stripJsonComments(content: string): string {
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//')) return '';
      return line;
    })
    .join('\n');
}

test('wrangler.jsonc e wrangler.toml são válidos, sincronizados e sem segredos em vars', () => {
  const rootDir = process.cwd();
  const jsoncRaw = fs.readFileSync(path.join(rootDir, 'wrangler.jsonc'), 'utf8');
  const tomlRaw = fs.readFileSync(path.join(rootDir, 'wrangler.toml'), 'utf8');

  const jsonc = JSON.parse(stripJsonComments(jsoncRaw));
  assert.equal(jsonc.name, 'news');
  assert.equal(jsonc.main, 'worker.js');
  assert.equal(jsonc.assets?.binding, 'ASSETS');
  assert.equal(jsonc.assets?.directory, './public');
  assert.equal(jsonc.assets?.run_worker_first, true);
  assert.equal(jsonc.vars?.NEWS_API_BASE_URL, 'https://news-sources-api.legislativemunicipal.workers.dev');
  assert.equal(jsonc.vars?.APP_URL, 'https://news.mirandinhacontabilidade.workers.dev');
  assert.equal(jsonc.vars?.SITE_DOMAIN, 'news.mirandinhacontabilidade.workers.dev');
  assert.equal(jsonc.vars?.NEXT_PUBLIC_SITE_URL, 'https://news.mirandinhacontabilidade.workers.dev');

  // Custom domains removidos para evitar erro [code: 10082] e usar https://news.mirandinhacontabilidade.workers.dev
  assert.equal(jsonc.routes, undefined);

  // Garante que nenhum segredo sensível está exposto nas vars públicas
  const forbiddenKeys = ['API_KEY', 'NEWS_API_KEY', 'GEMINI_API_KEY', 'REVALIDATE_SECRET', 'CRON_SECRET', 'SMTP_PASS', 'WEATHER_API_KEY', 'ELEVENLABS_API_KEY', 'ORIGIN_URL'];
  for (const key of forbiddenKeys) {
    assert.equal(key in (jsonc.vars || {}), false, `Segredo ${key} não deve estar em wrangler.jsonc vars`);
  }

  // Valida paridade com wrangler.toml
  assert.match(tomlRaw, /name\s*=\s*"news"/);
  assert.match(tomlRaw, /main\s*=\s*"worker\.js"/);
  assert.doesNotMatch(tomlRaw, /^\s*routes\s*=/m);
  assert.doesNotMatch(tomlRaw, /custom_domain\s*=\s*true/);
  assert.match(tomlRaw, /APP_URL\s*=\s*"https:\/\/news\.mirandinhacontabilidade\.workers\.dev"/);
  assert.match(tomlRaw, /SITE_DOMAIN\s*=\s*"news\.mirandinhacontabilidade\.workers\.dev"/);
  assert.match(tomlRaw, /NEXT_PUBLIC_SITE_URL\s*=\s*"https:\/\/news\.mirandinhacontabilidade\.workers\.dev"/);
  assert.match(tomlRaw, /NEWS_API_BASE_URL\s*=\s*"https:\/\/news-sources-api\.legislativemunicipal\.workers\.dev"/);
  assert.doesNotMatch(tomlRaw, /^\s*(API_KEY|NEWS_API_KEY|REVALIDATE_SECRET|SMTP_PASS)\s*=/m);

  // Garante que bun.lock/bun.lockb estão no .gitignore (lockfileVersion 2 incompatível com bun@1.2.15 no Cloudflare Builds) e valida package-lock.json
  const gitignoreRaw = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
  assert.match(gitignoreRaw, /^bun\.lock$/m, '.gitignore deve ignorar bun.lock para o Cloudflare usar package-lock.json');
  assert.match(gitignoreRaw, /^bun\.lockb$/m, '.gitignore deve ignorar bun.lockb');
  const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const pkgLockPath = path.join(rootDir, 'package-lock.json');
  assert.equal(fs.existsSync(pkgLockPath), true, 'package-lock.json deve existir e estar sincronizado com package.json');
  const pkgLock = JSON.parse(fs.readFileSync(pkgLockPath, 'utf8'));
  assert.equal(pkgLock.name, pkgJson.name);
  const lockPackages = Object.keys(pkgLock.packages || {});
  assert.ok(lockPackages.some((p) => p.includes('@tailwindcss/oxide-darwin-arm64')), 'package-lock.json deve conter optionalDependencies cross-platform');
  assert.ok(lockPackages.some((p) => p.includes('lightningcss-linux-arm64-gnu')), 'package-lock.json deve conter lightningcss optionalDependencies');
  assert.ok(lockPackages.some((p) => p.includes('@img/sharp-linuxmusl-x64')), 'package-lock.json deve conter sharp optionalDependencies');
  assert.ok(lockPackages.some((p) => p.includes('@next/swc-linux-x64-musl')), 'package-lock.json deve conter @next/swc optionalDependencies');
  const npmrcPath = path.join(rootDir, '.npmrc');
  assert.equal(fs.existsSync(npmrcPath), true, '.npmrc deve existir para garantir npm ci consistente');
  assert.match(fs.readFileSync(npmrcPath, 'utf8'), /legacy-peer-deps=true/);

  // Garante fontes locais em app/fonts/ e uso de next/font/local (evita erro TypeError no google/loader.js no build)
  const layoutSrc = fs.readFileSync(path.join(rootDir, 'app/layout.tsx'), 'utf8');
  assert.doesNotMatch(layoutSrc, /next\/font\/google/);
  assert.match(layoutSrc, /next\/font\/local/);
  assert.equal(fs.existsSync(path.join(rootDir, 'app/fonts/inter-latin.woff2')), true);
  assert.equal(fs.existsSync(path.join(rootDir, 'app/fonts/source-serif-4-latin.woff2')), true);
});

test('resolveDnsAndCanonical redireciona www e http de produção sem redirecionar workers de preview ou localhost', () => {
  const wwwReq = new Request('https://www.news.mirandinhacontabilidade.workers.dev/categoria/justica?page=2');
  const wwwRes = resolveDnsAndCanonical(wwwReq);
  assert.ok(wwwRes);
  assert.equal(wwwRes.status, 301);
  assert.equal(wwwRes.headers.get('location'), 'https://news.mirandinhacontabilidade.workers.dev/categoria/justica?page=2');

  const httpApexReq = new Request('http://news.mirandinhacontabilidade.workers.dev/contato', {
    headers: { 'cf-visitor': JSON.stringify({ scheme: 'http' }) },
  });
  const httpApexRes = resolveDnsAndCanonical(httpApexReq);
  assert.ok(httpApexRes);
  assert.equal(httpApexRes.status, 301);
  assert.equal(httpApexRes.headers.get('location'), 'https://news.mirandinhacontabilidade.workers.dev/contato');

  const workersDevReq = new Request('https://news.mirandinhacontabilidade.workers.dev/');
  assert.equal(resolveDnsAndCanonical(workersDevReq), null);

  const localReq = new Request('http://localhost:3000/');
  assert.equal(resolveDnsAndCanonical(localReq), null);
});

test('resolveSafeOriginUrl bloqueia loops DNS (news.mirandinhacontabilidade.workers.dev / hop >= 1) e aceita origin externo válido', () => {
  const currentUrl = new URL('https://news.mirandinhacontabilidade.workers.dev/');

  assert.equal(
    resolveSafeOriginUrl({ ORIGIN_URL: 'https://news.mirandinhacontabilidade.workers.dev' }, currentUrl, new Headers()),
    null
  );
  assert.equal(
    resolveSafeOriginUrl({ ORIGIN_URL: 'https://www.news.mirandinhacontabilidade.workers.dev' }, currentUrl, new Headers()),
    null
  );
  assert.equal(
    resolveSafeOriginUrl(
      { ORIGIN_URL: 'https://origin-node.example.com' },
      currentUrl,
      new Headers({ 'x-nj-worker-hop': '1' })
    ),
    null
  );

  const validOrigin = resolveSafeOriginUrl(
    { ORIGIN_URL: 'https://origin-node.example.com' },
    currentUrl,
    new Headers()
  );
  assert.ok(validOrigin);
  assert.equal(validOrigin.origin, 'https://origin-node.example.com');
});

test('resolveWorkerNewsApiConfig e buildWorkerNewsApiHeaders lêem env secrets corretamente', () => {
  const cfg = resolveWorkerNewsApiConfig({
    NEWS_API_BASE_URL: 'https://news-sources-api.legislativemunicipal.workers.dev/',
    API_KEY: 'worker-secret-token',
  });
  assert.equal(cfg.baseUrl, 'https://news-sources-api.legislativemunicipal.workers.dev');
  assert.equal(cfg.apiKey, 'worker-secret-token');

  const headers = buildWorkerNewsApiHeaders(cfg.apiKey) as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer worker-secret-token');
  assert.equal(headers['x-api-key'], 'worker-secret-token');

  const cleaned = sanitizePublicData({ ok: true, apiKey: 'leak', token: 'leak', nested: { secret: '123', title: 'Ok' } });
  assert.deepEqual(cleaned, { ok: true, nested: { title: 'Ok' } });
});

test('worker.fetch atende endpoints /api/*, SEO XML, páginas SSR e cron scheduled', async () => {
  const originalFetch = globalThis.fetch;
  const sampleFeed = [
    {
      id: '101',
      title: 'STF analisa marco regulatório digital em sessão plenária',
      slug: 'stf-analisa-marco-regulatorio-digital-101',
      category: 'Justiça',
      description: 'Sessão plenária debate parâmetros constitucionais para plataformas digitais.',
      contentHtml: '<p>O Supremo Tribunal Federal iniciou nesta quarta-feira o julgamento sobre transparência digital.</p>',
      pubDate: new Date().toISOString(),
      imageUrl: 'https://cdn.example.com/stf.jpg',
      author: 'Redação',
    },
  ];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.includes('/api/types')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/api/news')) {
      return new Response(JSON.stringify({ items: sampleFeed }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const env = {
      NEWS_API_BASE_URL: 'https://news-sources-api.legislativemunicipal.workers.dev',
      API_KEY: 'test-key',
      REVALIDATE_SECRET: 'super-secret-token',
    };

    // /api/health
    const healthRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/api/health'), env);
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get('X-Content-Type-Options'), 'nosniff');
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, 'healthy');
    assert.equal(healthJson.platform, 'cloudflare-worker');

    // /api/revalidate sem segredo e com segredo
    const unauthReval = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/api/revalidate?secret=wrong'), env);
    assert.equal(unauthReval.status, 401);
    const okReval = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/api/revalidate?secret=super-secret-token'), env);
    assert.equal(okReval.status, 200);

    // /api/news
    const newsRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/api/news?limit=5'), env);
    assert.equal(newsRes.status, 200);
    const newsJson = await newsRes.json();
    assert.equal(newsJson.items.length, 1);
    assert.equal(newsJson.items[0].slug, 'stf-analisa-marco-regulatorio-digital-101');

    // /api/sync?format=html
    const syncHtmlRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/api/sync?format=html'), env);
    assert.equal(syncHtmlRes.status, 200);
    assert.match(await syncHtmlRes.text(), /Cloudflare Worker Edge Ativo/);

    // /api/contact validação e geração de protocolo
    const contactRes = await worker.fetch(
      new Request('https://news.mirandinhacontabilidade.workers.dev/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Maria Silva',
          email: 'maria@example.com',
          subject: 'Pauta',
          message: 'Gostaria de enviar uma sugestão de reportagem sobre legislação.',
        }),
      }),
      env
    );
    assert.equal(contactRes.status, 200);
    const contactJson = await contactRes.json();
    assert.equal(contactJson.success, true);
    assert.match(contactJson.protocol, /^NJ-\d{8}-[A-Z0-9]{4}$/);

    // SEO: /robots.txt & /sitemap.xml
    const robotsRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/robots.txt'), env);
    assert.equal(robotsRes.status, 200);
    assert.match(await robotsRes.text(), /Sitemap: https:\/\/news\.mirandinhacontabilidade\.workers\.dev\/sitemap\.xml/);

    const sitemapRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/sitemap.xml'), env);
    assert.equal(sitemapRes.status, 200);
    assert.match(await sitemapRes.text(), /sitemap-posts\.xml/);

    // SSR Home (/) & Matéria (/noticia/[slug]) & Redirecionamento de slug ausente (307)
    const homeRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/'), env);
    assert.equal(homeRes.status, 200);
    const homeHtml = await homeRes.text();
    assert.match(homeHtml, /STF analisa marco regulatório digital/);

    const articleRes = await worker.fetch(
      new Request('https://news.mirandinhacontabilidade.workers.dev/noticia/stf-analisa-marco-regulatorio-digital-101'),
      env
    );
    assert.equal(articleRes.status, 200);
    const articleHtml = await articleRes.text();
    assert.match(articleHtml, /Ouvir Notícia/);
    assert.match(articleHtml, /Compartilhe esta informação/);

    const missingArticleRes = await worker.fetch(
      new Request('https://news.mirandinhacontabilidade.workers.dev/noticia/noticia-inexistente-999'),
      env
    );
    assert.equal(missingArticleRes.status, 307);

    // 404 para rota desconhecida
    const notFoundRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/rota-que-nao-existe'), env);
    assert.equal(notFoundRes.status, 404);

    // Cron scheduled
    await worker.scheduled({}, env, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('stripForcedAlignmentStyles, sanitizeArticleHtmlForWorker e splitTextForTts garantem justificação, zoom e TTS segmentado', () => {
  const dirtyHtml = `
    <p style="text-align: left; color: #111; font-size: 16px;" align="left">Primeiro parágrafo forçado à esquerda.</p>
    <div style="text-align:right">Segundo bloco desalinhado.</div>
    <img src="https://cdn.example.com/foto-exclusiva.jpg" alt="Sessão Plenária" />
  `;
  const stripped = stripForcedAlignmentStyles(dirtyHtml);
  assert.doesNotMatch(stripped, /text-align\s*:/i);
  assert.doesNotMatch(stripped, /\balign\s*=/i);

  const sanitized = sanitizeArticleHtmlForWorker(dirtyHtml, 'https://cdn.example.com/capa.jpg');
  assert.doesNotMatch(sanitized, /text-align\s*:/i);
  assert.doesNotMatch(sanitized, /\balign\s*=/i);
  assert.match(sanitized, /<figure class="my-6 not-prose">[\s\S]*class="zoom-frame[^>]*">[\s\S]*<figcaption/);

  const longText =
    'O Supremo Tribunal Federal iniciou nesta quarta-feira o julgamento sobre transparência digital nas plataformas online. ' +
    'Diversas entidades jurídicas apresentaram manifestações técnicas ao plenário visando a segurança normativa. ' +
    'Além disso, especialistas destacam que a regulamentação fortalece a previsibilidade institucional em todo o território nacional.';
  const chunks = splitTextForTts(longText, 120);
  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 120, `Chunk excedeu 120 chars: ${chunk.length}`);
  }
});

test('worker.fetch entrega sitemaps estilizados para navegadores, XML para robôs e paridade completa de UI (Home, Carrossel, Favoritos, Artigo)', async () => {
  const originalFetch = globalThis.fetch;
  const sampleFeed = Array.from({ length: 12 }, (_, idx) => ({
    id: String(200 + idx),
    title: `Decisão institucional nº ${idx + 1} impacta setor regulatório nacional`,
    slug: `decisao-institucional-${idx + 1}-regulacao`,
    category: idx % 2 === 0 ? 'Justiça' : 'Política',
    description: `Resumo detalhado da decisão institucional nº ${idx + 1} sobre regulação pública.`,
    contentHtml: `<p style="text-align:left">Parágrafo de teste da reportagem nº ${idx + 1}.</p><img src="https://cdn.example.com/img-${idx + 1}.jpg" alt="Imagem ${idx + 1}" />`,
    pubDate: new Date(Date.now() - idx * 60000).toISOString(),
    imageUrl: `https://cdn.example.com/capa-${idx + 1}.jpg`,
    author: 'Redação',
  }));

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.includes('/api/news')) {
      return new Response(JSON.stringify({ items: sampleFeed }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const env = {
      NEWS_API_BASE_URL: 'https://news-sources-api.legislativemunicipal.workers.dev',
      API_KEY: 'test-key',
    };
    const browserHeaders = { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' };

    // 1. Sitemaps HTML estilizados para navegadores vs XML bruto
    for (const smPath of ['/sitemap.xml', '/sitemap-posts.xml', '/sitemap-categories.xml', '/sitemap-pages.xml', '/sitemap-images.xml']) {
      const htmlRes = await worker.fetch(new Request(`https://news.mirandinhacontabilidade.workers.dev${smPath}`, { headers: browserHeaders }), env);
      assert.equal(htmlRes.status, 200);
      assert.match(htmlRes.headers.get('content-type') || '', /text\/html/);
      const htmlBody = await htmlRes.text();
      assert.match(htmlBody, /#1d4ed8/);
      assert.match(htmlBody, /Total de URLs listadas:/);

      const xmlRes = await worker.fetch(new Request(`https://news.mirandinhacontabilidade.workers.dev${smPath}?format=xml`, { headers: browserHeaders }), env);
      assert.equal(xmlRes.status, 200);
      assert.match(xmlRes.headers.get('content-type') || '', /application\/xml/);
      assert.match(await xmlRes.text(), /^<\?xml version="1\.0"/);
    }

    const customSitemap = renderWorkerSitemapHtml({
      title: 'Teste Sitemap',
      description: 'Descrição teste',
      entries: [{ url: 'https://news.mirandinhacontabilidade.workers.dev/', title: 'Home', changefreq: 'hourly', priority: '1.0' }],
    });
    assert.match(customSitemap, /Norma Jurídica/);

    // 2. Home SSR: Carrossel 10 slides, WeatherCard, Grade/Compacto, Minha Lista Drawer, CSS Animado e Justificação
    const homeRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/'), env);
    assert.equal(homeRes.status, 200);
    const homeHtml = await homeRes.text();
    assert.match(homeHtml, /id="nj-featured-carousel"/);
    assert.match(homeHtml, /animate-slide-progress/);
    assert.match(homeHtml, /id="nj-weather-card"/);
    assert.match(homeHtml, /id="nj-view-grid-btn"/);
    assert.match(homeHtml, /id="nj-view-compact-btn"/);
    assert.match(homeHtml, /id="nj-list-drawer"/);
    assert.match(homeHtml, /text-align:\s*justify\s*!important/);
    assert.match(homeHtml, /\.zoom-frame:hover img/);
    assert.match(homeHtml, /hyphens:\s*none\s*!important/);

    // 3. Favoritos (?cat=favoritos) & ?article= redirect
    const favRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/?cat=favoritos'), env);
    assert.equal(favRes.status, 200);
    const favHtml = await favRes.text();
    assert.match(favHtml, /Minha Lista/);
    assert.match(favHtml, /data-active-cat', 'favoritos'/);

    const artRedirectRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/?article=decisao-institucional-1-regulacao'), env);
    assert.equal(artRedirectRes.status, 307);
    assert.equal(artRedirectRes.headers.get('location'), 'https://news.mirandinhacontabilidade.workers.dev/noticia/decisao-institucional-1-regulacao');

    // 4. Artigo SSR: Resumo da Notícia, Share SVGs, Chunked Web Speech API, zoom-frame
    const artRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/noticia/decisao-institucional-1-regulacao'), env);
    assert.equal(artRes.status, 200);
    const artHtml = await artRes.text();
    assert.match(artHtml, /Resumo da Notícia/);
    assert.match(artHtml, /Pontos Principais:/);
    assert.match(artHtml, /splitSpeechChunks/);
    assert.match(artHtml, /SpeechSynthesisUtterance/);
    assert.match(artHtml, /Compartilhar no WhatsApp/);
    assert.match(artHtml, /Compartilhar no Instagram/);
    assert.match(artHtml, /id="nj-share-copied"/);
    assert.doesNotMatch(artHtml, /style="text-align:left"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
