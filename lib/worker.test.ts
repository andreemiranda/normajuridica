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
  assert.equal(jsonc.name, 'norma-juridica');
  assert.equal(jsonc.main, 'worker.js');
  assert.equal(jsonc.assets?.binding, 'ASSETS');
  assert.equal(jsonc.assets?.directory, './public');
  assert.equal(jsonc.assets?.run_worker_first, true);
  assert.equal(jsonc.vars?.NEWS_API_BASE_URL, 'https://news-sources-api.legislativemunicipal.workers.dev');
  assert.equal(jsonc.vars?.APP_URL, 'https://normajuridica.com.br');

  // Custom domains devem estar configurados para evitar Error 1000 / Error 1014 / loops DNS
  assert.ok(Array.isArray(jsonc.routes));
  const patterns = jsonc.routes.map((r: { pattern: string; custom_domain?: boolean }) => ({
    pattern: r.pattern,
    custom_domain: r.custom_domain,
  }));
  assert.deepEqual(patterns, [
    { pattern: 'normajuridica.com.br', custom_domain: true },
    { pattern: 'www.normajuridica.com.br', custom_domain: true },
  ]);

  // Garante que nenhum segredo sensível está exposto nas vars públicas
  const forbiddenKeys = ['API_KEY', 'NEWS_API_KEY', 'GEMINI_API_KEY', 'REVALIDATE_SECRET', 'CRON_SECRET', 'SMTP_PASS', 'WEATHER_API_KEY', 'ELEVENLABS_API_KEY', 'ORIGIN_URL'];
  for (const key of forbiddenKeys) {
    assert.equal(key in (jsonc.vars || {}), false, `Segredo ${key} não deve estar em wrangler.jsonc vars`);
  }

  // Valida paridade com wrangler.toml
  assert.match(tomlRaw, /name\s*=\s*"norma-juridica"/);
  assert.match(tomlRaw, /main\s*=\s*"worker\.js"/);
  assert.match(tomlRaw, /pattern\s*=\s*"normajuridica\.com\.br",\s*custom_domain\s*=\s*true/);
  assert.match(tomlRaw, /pattern\s*=\s*"www\.normajuridica\.com\.br",\s*custom_domain\s*=\s*true/);
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
});

test('resolveDnsAndCanonical redireciona www e http de produção sem redirecionar workers.dev ou localhost', () => {
  const wwwReq = new Request('https://www.normajuridica.com.br/categoria/justica?page=2');
  const wwwRes = resolveDnsAndCanonical(wwwReq);
  assert.ok(wwwRes);
  assert.equal(wwwRes.status, 301);
  assert.equal(wwwRes.headers.get('location'), 'https://normajuridica.com.br/categoria/justica?page=2');

  const httpApexReq = new Request('http://normajuridica.com.br/contato', {
    headers: { 'cf-visitor': JSON.stringify({ scheme: 'http' }) },
  });
  const httpApexRes = resolveDnsAndCanonical(httpApexReq);
  assert.ok(httpApexRes);
  assert.equal(httpApexRes.status, 301);
  assert.equal(httpApexRes.headers.get('location'), 'https://normajuridica.com.br/contato');

  const workersDevReq = new Request('https://norma-juridica.legislativemunicipal.workers.dev/');
  assert.equal(resolveDnsAndCanonical(workersDevReq), null);

  const localReq = new Request('http://localhost:3000/');
  assert.equal(resolveDnsAndCanonical(localReq), null);
});

test('resolveSafeOriginUrl bloqueia loops DNS (normajuridica.com.br / hop >= 1) e aceita origin externo válido', () => {
  const currentUrl = new URL('https://normajuridica.com.br/');

  assert.equal(
    resolveSafeOriginUrl({ ORIGIN_URL: 'https://normajuridica.com.br' }, currentUrl, new Headers()),
    null
  );
  assert.equal(
    resolveSafeOriginUrl({ ORIGIN_URL: 'https://www.normajuridica.com.br' }, currentUrl, new Headers()),
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
    const healthRes = await worker.fetch(new Request('https://normajuridica.com.br/api/health'), env);
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get('X-Content-Type-Options'), 'nosniff');
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, 'healthy');
    assert.equal(healthJson.platform, 'cloudflare-worker');

    // /api/revalidate sem segredo e com segredo
    const unauthReval = await worker.fetch(new Request('https://normajuridica.com.br/api/revalidate?secret=wrong'), env);
    assert.equal(unauthReval.status, 401);
    const okReval = await worker.fetch(new Request('https://normajuridica.com.br/api/revalidate?secret=super-secret-token'), env);
    assert.equal(okReval.status, 200);

    // /api/news
    const newsRes = await worker.fetch(new Request('https://normajuridica.com.br/api/news?limit=5'), env);
    assert.equal(newsRes.status, 200);
    const newsJson = await newsRes.json();
    assert.equal(newsJson.items.length, 1);
    assert.equal(newsJson.items[0].slug, 'stf-analisa-marco-regulatorio-digital-101');

    // /api/sync?format=html
    const syncHtmlRes = await worker.fetch(new Request('https://normajuridica.com.br/api/sync?format=html'), env);
    assert.equal(syncHtmlRes.status, 200);
    assert.match(await syncHtmlRes.text(), /Cloudflare Worker Edge Ativo/);

    // /api/contact validação e geração de protocolo
    const contactRes = await worker.fetch(
      new Request('https://normajuridica.com.br/api/contact', {
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
    const robotsRes = await worker.fetch(new Request('https://normajuridica.com.br/robots.txt'), env);
    assert.equal(robotsRes.status, 200);
    assert.match(await robotsRes.text(), /Sitemap: https:\/\/normajuridica\.com\.br\/sitemap\.xml/);

    const sitemapRes = await worker.fetch(new Request('https://normajuridica.com.br/sitemap.xml'), env);
    assert.equal(sitemapRes.status, 200);
    assert.match(await sitemapRes.text(), /sitemap-posts\.xml/);

    // SSR Home (/) & Matéria (/noticia/[slug]) & Redirecionamento de slug ausente (307)
    const homeRes = await worker.fetch(new Request('https://normajuridica.com.br/'), env);
    assert.equal(homeRes.status, 200);
    const homeHtml = await homeRes.text();
    assert.match(homeHtml, /STF analisa marco regulatório digital/);

    const articleRes = await worker.fetch(
      new Request('https://normajuridica.com.br/noticia/stf-analisa-marco-regulatorio-digital-101'),
      env
    );
    assert.equal(articleRes.status, 200);
    const articleHtml = await articleRes.text();
    assert.match(articleHtml, /Ouvir Notícia/);
    assert.match(articleHtml, /Compartilhe esta informação/);

    const missingArticleRes = await worker.fetch(
      new Request('https://normajuridica.com.br/noticia/noticia-inexistente-999'),
      env
    );
    assert.equal(missingArticleRes.status, 307);

    // 404 para rota desconhecida
    const notFoundRes = await worker.fetch(new Request('https://normajuridica.com.br/rota-que-nao-existe'), env);
    assert.equal(notFoundRes.status, 404);

    // Cron scheduled
    await worker.scheduled({}, env, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
