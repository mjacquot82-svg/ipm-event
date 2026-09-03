import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adminRequest, loginOrganizer } from '../src/services/adminAuthService.ts';

const netlifyConfig = await readFile(new URL('../../netlify.toml', import.meta.url), 'utf8');

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: '', json: async () => body };
}

test('staging Organizer Portal uses the same-origin admin proxy', async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.window = { location: { hostname: 'staging.theipm.ca' } };
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return response({ user: {} });
  };

  try {
    await loginOrganizer({ username: ' organizer ', password: 'not-a-real-password', event_id: 'ipm-2026' });
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }

  assert.equal(calls[0].url, '/api/admin/auth/login');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(Object.keys(body).sort(), ['event_id', 'password', 'username']);
  assert.equal(body.event_id, 'ipm-2026');
  assert.equal(body.username, 'organizer');
});

test('non-staging hosts retain the configured backend URL', async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  let requestUrl = '';
  globalThis.window = { location: { hostname: 'theipm.ca' } };
  globalThis.fetch = async (url) => {
    requestUrl = String(url);
    return response({ user: {} });
  };

  try {
    await adminRequest('/api/admin/auth/me');
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }

  assert.match(requestUrl, /^https:\/\/[^/]+\/api\/admin\/auth\/me$/);
});

test('Netlify sends only staging admin routes to the staging backend before the SPA fallback', () => {
  assert.match(netlifyConfig, /from = "\/api\/admin\/\*"\s+to = "https:\/\/ipm-staging-backend\.onrender\.com\/api\/admin\/:splat"\s+status = 200\s+force = true/);
  assert.ok(netlifyConfig.indexOf('from = "/api/admin/*"') < netlifyConfig.indexOf('from = "/*"'));
});
