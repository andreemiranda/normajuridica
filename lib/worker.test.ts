import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import worker, {
  resolveDnsAndCanonical,
  resolveSafeOriginUrl,
  resolveWorkerSiteConfig,
  resolveWorkerNewsApiConfig,
  buildWorkerNewsApiHeaders,
  sanitizePublicData,
  stripForcedAlignmentStyles,
  sanitizeArticleHtmlForWorker,
  renderWorkerSitemapHtml,
  splitTextForTts,
  upgradeImageResolution,
  extractImageFromItem,
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

test('resolveWorkerSiteConfig e resolveWorkerNewsApiConfig lêem todas as variações de variáveis e process.env', () => {
  const site = resolveWorkerSiteConfig({
    APP_URL: '"https://custom-portal.example.com/"',
    SITE_DOMAIN: "'custom-portal.example.com'",
  });
  assert.equal(site.domain, 'custom-portal.example.com');
  assert.equal(site.appUrl, 'https://custom-portal.example.com');
  assert.equal(site.hasAppUrlVar, true);
  assert.equal(site.hasSiteDomainVar, true);

  const siteNext = resolveWorkerSiteConfig({
    NEXT_PUBLIC_SITE_URL: 'https://next-portal.example.com/noticias',
    NEXT_PUBLIC_SITE_DOMAIN: 'next-portal.example.com',
  });
  assert.equal(siteNext.domain, 'next-portal.example.com');
  assert.equal(siteNext.appUrl, 'https://next-portal.example.com');

  // Fallback para process.env quando env não é passado e leitura case-insensitive no env
  const caseInsensitive = resolveWorkerSiteConfig({
    app_url: 'https://case-portal.example.com/',
    site_domain: 'case-portal.example.com',
  });
  assert.equal(caseInsensitive.domain, 'case-portal.example.com');
  assert.equal(caseInsensitive.appUrl, 'https://case-portal.example.com');

  const prevAppUrl = process.env.APP_URL;
  const prevNextAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'https://proc-portal.example.com';
  try {
    const fromProc = resolveWorkerSiteConfig({ CLOUDFLARE_WORKER: 'true' });
    assert.equal(fromProc.domain, 'proc-portal.example.com');
    assert.equal(fromProc.appUrl, 'https://proc-portal.example.com');
  } finally {
    if (prevAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = prevAppUrl;
    if (prevNextAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevNextAppUrl;
  }

  const cfg = resolveWorkerNewsApiConfig({
    API_URL_BASE: ' "https://news-sources-api.legislativemunicipal.workers.dev/api" ',
    APIKEY: ' "Bearer my-worker-key" ',
  });
  assert.equal(cfg.baseUrl, 'https://news-sources-api.legislativemunicipal.workers.dev');
  assert.equal(cfg.apiKey, 'my-worker-key');

  const bareWorkers = resolveWorkerNewsApiConfig({
    NEWS_API_BASE_URL: 'https://workers.dev',
    NEWS_API_KEY: 'alt-key',
  });
  assert.equal(bareWorkers.baseUrl, 'https://news-sources-api.legislativemunicipal.workers.dev');
  assert.equal(bareWorkers.apiKey, 'alt-key');

  const headers = buildWorkerNewsApiHeaders(cfg.apiKey, {
    APP_URL: 'https://custom-portal.example.com',
    SITE_DOMAIN: 'custom-portal.example.com',
  }) as Record<string, string>;
  assert.equal(headers.Origin, 'https://custom-portal.example.com');
  assert.equal(headers.Referer, 'https://custom-portal.example.com/');
  assert.equal(headers['X-Site-Domain'], 'custom-portal.example.com');
  assert.match(headers['User-Agent'], /custom-portal\.example\.com/);

  const wwwCustom = resolveDnsAndCanonical(
    new Request('https://www.custom-portal.example.com/categoria/politica'),
    { SITE_DOMAIN: 'custom-portal.example.com' }
  );
  assert.ok(wwwCustom);
  assert.equal(wwwCustom.status, 301);
  assert.equal(wwwCustom.headers.get('location'), 'https://custom-portal.example.com/categoria/politica');
});

test('worker.fetch descobre fontes via catálogo /api/news, aplica retry ?ref= em 401 e expõe diagnóstico seguro no /api/sync', async () => {
  const originalFetch = globalThis.fetch;
  const seenUrls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    seenUrls.push(urlStr);

    // Simula API exigindo ?ref= quando headers são ignorados pelo proxy
    const parsed = new URL(urlStr);
    if (!parsed.searchParams.get('ref')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (parsed.pathname === '/api/types') {
      return new Response(JSON.stringify({ types: ['rss', 'api'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (parsed.pathname === '/api/news') {
      return new Response(
        JSON.stringify({
          items: [
            { id: '999001', category: 'Justiça', endpoint: '/api/news/999001', active: true },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (parsed.pathname === '/api/news/999001') {
      return new Response(
        JSON.stringify({
          items: [
            {
              id: 'art-999001-1',
              title: 'Descoberta dinâmica de fontes carrega notícias em tempo real no Worker',
              slug: 'descoberta-dinamica-de-fontes-999001',
              description: 'Reportagem carregada após retry automático com parâmetro ref.',
              content: '<p>Conteúdo completo da notícia obtida via endpoint da fonte ativa.</p>',
              publishedAt: new Date().toISOString(),
              imageUrl: 'https://cdn.example.com/dinamica.jpg',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const env = {
      API_URL_BASE: 'https://news-sources-api.legislativemunicipal.workers.dev/api',
      APIKEY: 'Bearer secret-ref-token',
      APP_URL: 'https://news.mirandinhacontabilidade.workers.dev',
      SITE_DOMAIN: 'news.mirandinhacontabilidade.workers.dev',
    };

    const syncRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/api/sync'), env);
    assert.equal(syncRes.status, 200);
    const syncJson = await syncRes.json();
    assert.equal(syncJson.upstream.status, 'conectado');
    assert.equal(syncJson.upstream.httpStatus, 200);
    assert.equal(syncJson.upstream.authConfigured, true);
    assert.equal(syncJson.upstream.endpoint, 'https://news-sources-api.legislativemunicipal.workers.dev');
    assert.equal(syncJson.site.domain, 'news.mirandinhacontabilidade.workers.dev');
    assert.equal(syncJson.site.appUrl, 'https://news.mirandinhacontabilidade.workers.dev');
    // Garante que nenhuma chave secreta vaza no JSON público
    assert.equal('apiKey' in syncJson.upstream, false);

    const newsRes = await worker.fetch(
      new Request('https://news.mirandinhacontabilidade.workers.dev/api/news?refresh=true&limit=10'),
      env
    );
    assert.equal(newsRes.status, 200);
    const newsJson = await newsRes.json();
    assert.equal(newsJson.items.length, 1);
    assert.equal(newsJson.items[0].slug, 'descoberta-dinamica-de-fontes-999001');
    assert.equal(newsJson.items[0].category, 'Justiça');
    assert.ok(seenUrls.some((u) => u.includes('ref=secret-ref-token')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('worker suporta novos aliases de token, ?ref= embutido, /api/sync estilo desenvolvimento e todas páginas SSR', async () => {
  const embeddedCfg = resolveWorkerNewsApiConfig({
    API_URL_BASE: 'https://news-sources-api.legislativemunicipal.workers.dev/api?ref=embedded-key-777',
  });
  assert.equal(embeddedCfg.baseUrl, 'https://news-sources-api.legislativemunicipal.workers.dev');
  assert.equal(embeddedCfg.apiKey, 'embedded-key-777');

  const aliasCfg = resolveWorkerNewsApiConfig({
    NEWS_API_TOKEN: 'Bearer token-alias-abc',
  });
  assert.equal(aliasCfg.apiKey, 'token-alias-abc');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.includes('/api/types')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    // 1. /api/sync?format=html sem chave exibe painel completo e orientação Cloudflare Runtime
    const syncAlertRes = await worker.fetch(
      new Request('https://news.mirandinhacontabilidade.workers.dev/api/sync?format=html'),
      {}
    );
    assert.equal(syncAlertRes.status, 200);
    const syncAlertHtml = await syncAlertRes.text();
    assert.match(syncAlertHtml, /Armazenamento Edge &amp; Sincronização/);
    assert.match(syncAlertHtml, /Capacidade Máxima \(FIFO\)/);
    assert.match(syncAlertHtml, /Variables and Secrets/);
    assert.match(syncAlertHtml, /Forçar Sincronização Agora/);
    assert.match(syncAlertHtml, /Voltar ao Portal/);

    // 2. Home vazia exibe estado de apuração (sem quebrar)
    const emptyHomeRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/'), {});
    assert.equal(emptyHomeRes.status, 200);
    const emptyHomeHtml = await emptyHomeRes.text();
    assert.match(emptyHomeHtml, /Edição em apuração • Destaques/);
    assert.match(emptyHomeHtml, /Ver todas as notícias/);

    // 3. Categoria (/categoria/justica) exibe subtítulo e empty state completo
    const catRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/categoria/justica'), {});
    assert.equal(catRes.status, 200);
    const catHtml = await catRes.text();
    assert.match(catHtml, /Cobertura analítica e factual sobre justiça/);
    assert.match(catHtml, /Edição em apuração • Justiça/);

    // 4. Contato (/contato) com 2 colunas, horários e <select>
    const contactPageRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/contato'), {});
    assert.equal(contactPageRes.status, 200);
    const contactPageHtml = await contactPageRes.text();
    assert.match(contactPageHtml, /Informações Institucionais/);
    assert.match(contactPageHtml, /Plantão Editorial: 24 horas/);
    assert.match(contactPageHtml, /<select id="nj-c-subject"/);
    assert.match(contactPageHtml, /Copiar Protocolo/);

    // 5. Páginas legais (/privacidade, /termos, /cookies) e institucionais (/pagina/sobre)
    const privRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/privacidade'), {});
    assert.equal(privRes.status, 200);
    assert.match(await privRes.text(), /Encarregado pelo Tratamento de Dados \(DPO\)/);

    const termosRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/termos'), {});
    assert.equal(termosRes.status, 200);
    assert.match(await termosRes.text(), /Lei nº 9\.610\/1998/);

    const cookiesRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/cookies'), {});
    assert.equal(cookiesRes.status, 200);
    assert.match(await cookiesRes.text(), /Cookies Essenciais:/);

    const sobreRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/pagina/sobre'), {});
    assert.equal(sobreRes.status, 200);
    const sobreHtml = await sobreRes.text();
    assert.match(sobreHtml, /Nossa Missão/);
    assert.match(sobreHtml, /Voltar ao índice institucional/);

    // 6. Página 404 com barra de busca e atalhos das editorias
    const notFoundRes = await worker.fetch(new Request('https://news.mirandinhacontabilidade.workers.dev/pagina-inexistente'), {});
    assert.equal(notFoundRes.status, 404);
    const notFoundHtml = await notFoundRes.text();
    assert.match(notFoundHtml, /Navegue pelas Principais Editorias/);
    assert.match(notFoundHtml, /Tecnologia &amp; Games/);

    // 7. Footer com ícones institucionais
    assert.match(emptyHomeHtml, /Dados Institucionais Oficiais/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('worker atualiza imagens ?w=200, resize= e srcset para alta resolução em cards, hero, matérias e /api/news', async () => {
  assert.equal(
    upgradeImageResolution('https://i0.wp.com/site.com/wp-content/uploads/2026/11/foto.jpg?w=200&ssl=1'),
    'https://i0.wp.com/site.com/wp-content/uploads/2026/11/foto.jpg?w=1200&ssl=1'
  );
  assert.equal(
    upgradeImageResolution('https://site.com/wp-content/uploads/foto.jpg?resize=200,133'),
    'https://site.com/wp-content/uploads/foto.jpg?w=1200'
  );
  assert.equal(
    extractImageFromItem({
      imageUrl: 'https://site.com/wp-content/uploads/foto.jpg?w=200',
    }),
    'https://site.com/wp-content/uploads/foto.jpg?w=1200'
  );
  assert.equal(
    extractImageFromItem({
      thumbnail: 'https://site.com/wp-content/uploads/foto-200x133.jpg',
      content: '<p><img src="https://site.com/wp-content/uploads/foto.jpg?w=200" /></p>',
    }),
    'https://site.com/wp-content/uploads/foto.jpg?w=1200'
  );

  const sanitizedBody = sanitizeArticleHtmlForWorker(
    '<p><img src="https://site.com/wp-content/uploads/corpo.jpg?w=200" alt="Corpo" /></p>',
    'https://site.com/wp-content/uploads/capa.jpg?w=200'
  );
  assert.match(sanitizedBody, /src="https:\/\/site\.com\/wp-content\/uploads\/corpo\.jpg\?w=1200"/);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.includes('/api/news?')) {
      return new Response(
        JSON.stringify({
          items: [
            {
              id: 'hd-img-1',
              title: 'Matéria com imagem em baixa resolução corrigida automaticamente',
              slug: 'materia-com-imagem-w200',
              category: 'Justiça',
              description: 'Resumo completo da matéria.',
              content: '<p>Primeiro parágrafo.</p><p><img src="https://cdn.example.com/foto-interna.jpg?w=200" alt="Interna" /></p>',
              publishedAt: new Date().toISOString(),
              imageUrl: 'https://i0.wp.com/cdn.example.com/capa.jpg?w=200&h=133&ssl=1',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    const env = {
      NEWS_API_BASE_URL: 'https://news-sources-api.legislativemunicipal.workers.dev',
      NEWS_API_KEY: 'key-test',
    };
    const apiRes = await worker.fetch(
      new Request('https://news.mirandinhacontabilidade.workers.dev/api/news?refresh=true&limit=5'),
      env
    );
    const apiJson = await apiRes.json();
    assert.equal(apiJson.items[0].imageUrl, 'https://i0.wp.com/cdn.example.com/capa.jpg?w=1200&ssl=1');

    const homeRes = await worker.fetch(
      new Request('https://news.mirandinhacontabilidade.workers.dev/?refresh=true'),
      env
    );
    const homeHtml = await homeRes.text();
    assert.match(homeHtml, /https:\/\/i0\.wp\.com\/cdn\.example\.com\/capa\.jpg\?w=1200&amp;ssl=1/);
    assert.equal(homeHtml.includes('?w=200'), false);

    const artRes = await worker.fetch(
      new Request('https://news.mirandinhacontabilidade.workers.dev/noticia/materia-com-imagem-w200'),
      env
    );
    const artHtml = await artRes.text();
    assert.match(artHtml, /https:\/\/cdn\.example\.com\/foto-interna\.jpg\?w=1200/);
    assert.equal(artHtml.includes('?w=200'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


