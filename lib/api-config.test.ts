import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NEWS_API_BASE_URL,
  resolveNewsApiConfig,
  buildNewsApiHeaders,
} from './api-config-pure';

test('resolveNewsApiConfig usa worker URL padrão quando NEWS_API_BASE_URL não está definida', () => {
  const config = resolveNewsApiConfig({} as NodeJS.ProcessEnv);
  assert.equal(config.baseUrl, DEFAULT_NEWS_API_BASE_URL);
  assert.equal(config.baseUrl, 'https://news-sources-api.legislativemunicipal.workers.dev');
  assert.equal(config.apiKey, '');
});

test('resolveNewsApiConfig lê exclusivamente NEWS_API_BASE_URL e ignora NEWS_API_FALLBACK_URL', () => {
  const config = resolveNewsApiConfig({
    NEWS_API_BASE_URL: '  https://custom-worker.example.com///  ',
    NEWS_API_FALLBACK_URL: 'https://news-sources-api.vercel.app',
  } as unknown as NodeJS.ProcessEnv);

  assert.equal(config.baseUrl, 'https://custom-worker.example.com');
  assert.equal('fallbackUrl' in config, false);
});

test('resolveNewsApiConfig lê API_KEY com prioridade e usa NEWS_API_KEY como alternativa de ambiente', () => {
  const withPrimary = resolveNewsApiConfig({
    API_KEY: '  secret-primary-key  ',
    NEWS_API_KEY: 'secret-secondary-key',
  } as unknown as NodeJS.ProcessEnv);
  assert.equal(withPrimary.apiKey, 'secret-primary-key');

  const withSecondary = resolveNewsApiConfig({
    NEWS_API_KEY: '  secret-secondary-key  ',
  } as unknown as NodeJS.ProcessEnv);
  assert.equal(withSecondary.apiKey, 'secret-secondary-key');
});

test('buildNewsApiHeaders anexa Bearer e x-api-key somente quando apiKey existe', () => {
  const withoutKey = buildNewsApiHeaders('');
  assert.equal(withoutKey['Accept'], 'application/json');
  assert.equal('Authorization' in withoutKey, false);
  assert.equal('x-api-key' in withoutKey, false);

  const withKey = buildNewsApiHeaders('token-123');
  assert.equal(withKey['Authorization'], 'Bearer token-123');
  assert.equal(withKey['x-api-key'], 'token-123');
});
