import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  verifySecret,
  sanitizeInput,
  escapeHtml,
  safeJsonLdStringify,
  isPrivateOrReservedHost,
  assertSafeExternalUrl,
  sanitizePublicData,
  isEnvironmentSecure,
  checkRateLimit,
} from './security';
import { resolveNewsApiConfig } from './api-config-pure';
import worker, {
  resolveSafeOriginUrl,
  resolveWorkerNewsApiConfig,
  applySecurityHeaders,
} from '../worker.js';

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.wrangler') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

test('verifySecret realiza comparação em tempo constante e rejeita entradas vazias ou divergentes', () => {
  assert.equal(verifySecret('segredo-forte-123', 'segredo-forte-123'), true);
  assert.equal(verifySecret('segredo-forte-124', 'segredo-forte-123'), false);
  assert.equal(verifySecret('curto', 'segredo-forte-123'), false);
  assert.equal(verifySecret('', ''), false);
  assert.equal(verifySecret(undefined, 'expected'), false);
});

test('escapeHtml e safeJsonLdStringify neutralizam vetores de XSS e </script>', () => {
  assert.equal(
    escapeHtml('<script>alert("xss")</script>'),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
  );

  const jsonLd = safeJsonLdStringify({ headline: '</script><script>alert(1)</script> & teste' });
  assert.equal(jsonLd.includes('</script>'), false);
  assert.equal(jsonLd.includes('\\u003c/script\\u003e'), true);
  assert.equal(jsonLd.includes('\\u0026'), true);
});

test('sanitizeInput remove bytes nulos, path traversal e quebras de linha', () => {
  assert.equal(sanitizeInput('../../etc/passwd\0\r\nok', 50), 'etc/passwd ok');
  assert.equal(sanitizeInput('a'.repeat(100), 10).length, 10);
});

test('assertSafeExternalUrl bloqueia SSRF em redes privadas, loopback, metadata e credenciais embutidas', () => {
  const blockedUrls = [
    'http://127.0.0.1:3000/api/sync',
    'http://localhost/admin',
    'http://169.254.169.254/latest/meta-data/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://10.0.0.1/internal',
    'http://172.16.5.10/internal',
    'http://192.168.1.1/router',
    'http://[::1]/secret',
    'http://[fc00::1]/secret',
    'https://user:pass@example.com/hook',
    'file:///etc/passwd',
    'ftp://example.com/file',
    'https://example.com:8443/custom-port',
  ];

  for (const url of blockedUrls) {
    assert.equal(assertSafeExternalUrl(url), null, `URL insegura deveria ser bloqueada: ${url}`);
  }

  assert.equal(isPrivateOrReservedHost('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedHost('example.com'), false);

  const allowed = assertSafeExternalUrl('https://portal.example.com/noticia/123');
  assert.ok(allowed);
  assert.equal(allowed.hostname, 'portal.example.com');
});

test('sanitizePublicData remove chaves sensíveis e mascara tokens e query params secretos em strings', () => {
  const cleaned = sanitizePublicData({
    status: 'ok',
    apiKey: 'secret-val',
    webhookUrl: 'https://hooks.example.com/123',
    nested: {
      geminiKey: 'secret-val',
      urlWithQuery: 'https://api.example.com/news?ref=supersecret&page=1',
      urlWithCreds: 'https://admin:hunter2@api.example.com/feed',
      msg: 'Falha com Bearer token-secreto-xyz-123456',
      safeTitle: 'Notícia pública',
    },
  });

  assert.equal('apiKey' in cleaned, false);
  assert.equal('webhookUrl' in cleaned, false);
  assert.equal('geminiKey' in cleaned.nested, false);
  assert.equal(cleaned.nested.urlWithQuery, 'https://api.example.com/news?ref=[REDACTED]&page=1');
  assert.equal(cleaned.nested.urlWithCreds, 'https://***:***@api.example.com/feed');
  assert.equal(cleaned.nested.msg.includes('token-secreto-xyz-123456'), false);
  assert.equal(cleaned.nested.safeTitle, 'Notícia pública');
});

test('isEnvironmentSecure e resolveNewsApiConfig proíbem segredos em variáveis NEXT_PUBLIC_*', () => {
  assert.equal(
    isEnvironmentSecure({
      NEXT_PUBLIC_ADSENSE_ID: 'ca-pub-7059730627018047',
      NEXT_PUBLIC_SITE_URL: 'https://normajuridica.com.br',
      NEXT_PUBLIC_WEATHER_API_BASE_URL: 'https://radarmeteorologico.com.br',
    }),
    true
  );

  assert.equal(
    isEnvironmentSecure({
      NEXT_PUBLIC_API_KEY: 'should-not-be-here',
    }),
    false
  );

  const nodeCfg = resolveNewsApiConfig({
    NEXT_PUBLIC_API_KEY: 'public-leak-attempt',
    NEXT_PUBLIC_NEWS_API_TOKEN: 'public-leak-attempt-2',
  } as unknown as NodeJS.ProcessEnv);
  assert.equal(nodeCfg.apiKey, '');

  const workerCfg = resolveWorkerNewsApiConfig({
    NEXT_PUBLIC_API_KEY: 'public-leak-attempt',
    NEXT_PUBLIC_NEWS_API_TOKEN: 'public-leak-attempt-2',
  });
  assert.equal(workerCfg.apiKey, '');
});

test('checkRateLimit limita requisições excedentes dentro da janela', () => {
  const id = `test-rl-${Date.now()}`;
  assert.equal(checkRateLimit(id, 2, 10000).allowed, true);
  assert.equal(checkRateLimit(id, 2, 10000).allowed, true);
  const third = checkRateLimit(id, 2, 10000);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
});

test('worker aplica CSP, headers de segurança em /api/* e bloqueia SSRF e export sem segredo', async () => {
  const currentUrl = new URL('https://normajuridica.com.br/');
  assert.equal(
    resolveSafeOriginUrl({ ORIGIN_URL: 'http://127.0.0.1:3000' }, currentUrl, new Headers()),
    null
  );
  assert.equal(
    resolveSafeOriginUrl({ ORIGIN_URL: 'http://169.254.169.254/latest' }, currentUrl, new Headers()),
    null
  );
  assert.equal(
    resolveSafeOriginUrl({ ORIGIN_URL: 'https://user:pass@origin-node.example.com' }, currentUrl, new Headers()),
    null
  );

  const apiSecured = applySecurityHeaders(new Response('{}', { status: 200 }), '/api/health');
  const csp = apiSecured.headers.get('Content-Security-Policy') || '';
  assert.ok(csp);
  assert.equal(csp.includes('unsafe-eval'), false);
  assert.equal(csp.includes('cdn.tailwindcss.com'), false);
  assert.equal(apiSecured.headers.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), browsing-topics=()');
  assert.equal(apiSecured.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
  assert.equal(apiSecured.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
  assert.equal(apiSecured.headers.get('X-XSS-Protection'), '0');
  assert.match(apiSecured.headers.get('Cache-Control') || '', /no-store/);

  const methodBlocked = await worker.fetch(
    new Request('https://normajuridica.com.br/api/health', { method: 'DELETE' }),
    {}
  );
  assert.equal(methodBlocked.status, 405);

  const exportNoSecret = await worker.fetch(
    new Request('https://normajuridica.com.br/api/sync?action=export'),
    {}
  );
  assert.equal(exportNoSecret.status, 503);

  const exportBadSecret = await worker.fetch(
    new Request('https://normajuridica.com.br/api/sync?action=export&secret=wrong'),
    { REVALIDATE_SECRET: 'real-secret' }
  );
  assert.equal(exportBadSecret.status, 401);
});

test('higiene do repositório: nenhum arquivo .md ou pasta sensível em /public/ e zero segredos reais vazados', () => {
  const rootDir = process.cwd();
  assert.equal(fs.existsSync(path.join(rootDir, 'public/assets/aistudio')), false);

  const publicFiles = walkFiles(path.join(rootDir, 'public'));
  assert.equal(
    publicFiles.some((f) => f.toLowerCase().endsWith('.md')),
    false,
    'Nenhum arquivo .md deve ficar exposto dentro de public/'
  );

  const allMdFiles = walkFiles(rootDir).filter((f) => f.toLowerCase().endsWith('.md'));
  const tokenPattern = /(?:AIza[0-9A-Za-z-_]{35}|sk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{24,}|gh[pous]_[0-9A-Za-z]{30,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}|NEWS_API_KEY_INLINE|escrever no código)/;

  for (const mdFile of allMdFiles) {
    const content = fs.readFileSync(mdFile, 'utf8');
    assert.equal(tokenPattern.test(content), false, `Arquivo Markdown contém padrão sensível: ${mdFile}`);
  }

  const envExample = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_API_KEY/);
  assert.doesNotMatch(envExample, /api_key_clima/);
  assert.equal(tokenPattern.test(envExample), false);
});
