import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPixelSnapshot, safeError, STAGING_ORIGIN } from './diagnostic.mjs';
const secret = 'DO_NOT_EXPOSE';
function fixture() {
  const calls = [];
  const mutation = () => { throw new Error('Mutation invoked'); };
  const registration = {
    scope: `${STAGING_ORIGIN}/`, active: { scriptURL: `${STAGING_ORIGIN}/webpushr-sw.js?webKey=${secret}` },
    update: mutation, unregister: mutation,
    pushManager: { subscribe: mutation, getSubscription: async () => ({ endpoint: secret, keys: secret }) },
  };
  const env = {
    location: { origin: STAGING_ORIGIN }, Notification: { permission: 'granted', requestPermission: mutation },
    navigator: { serviceWorker: { controller: {}, register: mutation, getRegistration: async (scope) => { calls.push(['registration', scope]); return registration; } } },
    localStorage: { getItem: (key) => { calls.push(['storage', key]); return 'a'.repeat(43); }, setItem: mutation, removeItem: mutation, clear: mutation },
    fetch: async (url, options) => {
      calls.push(['fetch', url, options]);
      assert.equal(options.method, 'GET');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      assert.ok(url.endsWith('/status-by-capability'));
      return { ok: true, json: async () => ({ provider_checked_at: '2026-09-04T12:52:53.977571+00:00', provider_has_push_token: true,
        provider_deliverable: true, provider_reachability: 'optIn', installation_id: secret, registration_fingerprint: secret, credentials: secret }) };
    },
  };
  return { env, calls, registration };
}
test('one bounded read: browser state and explicitly historical provider state, no secret output', async () => {
  const { env, calls } = fixture();
  const result = await readPixelSnapshot(env);
  assert.equal(result.notification_permission, 'granted');
  assert.equal(result.service_worker_controlled, true);
  assert.equal(result.active_worker_scope, 'STAGING_ROOT');
  assert.equal(result.wonderpush_worker_present, true);
  assert.equal(result.browser_push_subscription_present, true);
  assert.equal(result.current_provider_token_present, 'UNKNOWN_NO_LIVE_READ');
  assert.equal(result.current_os_notification_visibility, 'UNKNOWN_NO_LIVE_READ');
  assert.equal(result.last_known_provider_check_at, '2026-09-04T12:52:53.977Z');
  assert.equal(result.stored_provider_token_present, true);
  assert.equal(result.worker_init_error_class, 'UNKNOWN_NOT_OBSERVABLE');
  assert.equal(calls.filter(([name]) => name === 'fetch').length, 1);
  assert.equal(calls.filter(([name]) => name === 'storage').length, 1);
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(JSON.stringify(result).includes('a'.repeat(43)), false);
});
test('production and other origins cannot read browser, SDK, storage or backend', async () => {
  for (const origin of ['https://theipm.ca', 'https://ipm-web-staging.netlify.app', 'http://staging.theipm.ca']) {
    const env = new Proxy({ location: { origin } }, { get(target, key) {
      assert.equal(key, 'location'); return target[key];
    } });
    assert.deepEqual(await readPixelSnapshot(env), { diagnostic: 'STAGING_ONLY' });
  }
});
test('absent SDK is UNKNOWN, never a false unsubscribed/installation result', async () => {
  const { env } = fixture();
  const result = await readPixelSnapshot(env);
  assert.equal(result.wonderpush_local_subscribed, 'UNKNOWN');
  assert.equal(result.installation_id_present, 'UNKNOWN');
  assert.equal(result.wonderpush_initialization_state, 'SDK_NOT_LOADED_IN_DIAGNOSTIC');
});
test('already available SDK uses only getters and emits strict enums/booleans', async () => {
  const { env } = fixture();
  env.WonderPush = {
    getSessionState: () => 4, SessionState: { INIT_SUCCESS: 4 },
    isSubscribedToNotifications: async () => true, getInstallationId: async () => secret,
    init: () => assert.fail('init'), subscribeToNotifications: () => assert.fail('subscribe'),
  };
  const result = await readPixelSnapshot(env);
  assert.equal(result.wonderpush_initialization_state, 'INIT_SUCCESS');
  assert.equal(result.wonderpush_local_subscribed, true);
  assert.equal(result.installation_id_present, true);
  assert.equal(JSON.stringify(result).includes(secret), false);
});
test('missing or malformed existing capability never creates one or contacts backend', async () => {
  for (const capability of [null, '', secret]) {
    const { env } = fixture();
    env.localStorage.getItem = () => capability;
    env.fetch = () => assert.fail('must not fetch');
    const result = await readPixelSnapshot(env);
    assert.equal(result.stored_provider_read, 'NO_EXISTING_CAPABILITY');
  }
});
test('worker presence is not inferred from a controller or unrelated script', async () => {
  const { env, registration } = fixture();
  registration.active.scriptURL = `https://elsewhere.invalid/webpushr-sw.js?${secret}`;
  const result = await readPixelSnapshot(env);
  assert.equal(result.service_worker_controlled, true);
  assert.equal(result.wonderpush_worker_present, false);
});
test('read failures preserve UNKNOWN and redact arbitrary error names/messages', async () => {
  const { env, registration } = fixture();
  registration.pushManager.getSubscription = async () => { throw { name: secret, message: secret }; };
  env.fetch = async () => { throw { name: secret, message: secret }; };
  const result = await readPixelSnapshot(env);
  assert.equal(result.browser_push_subscription_present, 'UNKNOWN');
  assert.equal(result.diagnostic_read_error_class, 'OTHER_ERROR');
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(safeError({ name: 'SecurityError', message: secret }), 'SecurityError');
});
test('stored response fields cannot inject raw values into output', async () => {
  const { env } = fixture();
  env.fetch = async () => ({ ok: true, json: async () => ({ provider_checked_at: secret,
    provider_has_push_token: secret, provider_deliverable: secret, provider_reachability: secret }) });
  const result = await readPixelSnapshot(env);
  assert.equal(result.last_known_provider_check_at, 'UNKNOWN');
  assert.equal(result.stored_provider_token_present, 'UNKNOWN');
  assert.equal(JSON.stringify(result).includes(secret), false);
});
test('failed GET is not retried', async () => {
  const { env } = fixture(); let count = 0;
  env.fetch = async () => { count++; return { ok: false, status: 503 }; };
  const result = await readPixelSnapshot(env);
  assert.equal(count, 1); assert.equal(result.stored_provider_read, 'HTTP_ERROR');
});
test('isolated document loads no app, SDK, analytics or embedded secrets', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/<script/g) || []).length, 1);
  assert.match(html, /src="\.\/pixel-diagnostic-page.mjs"/);
  assert.doesNotMatch(html, /expo|wonderpush-loader|webKey|iframe|<form/);
  const page = readFileSync(new URL('./page.mjs', import.meta.url), 'utf8');
  assert.match(page, /once: true/);
  assert.match(page, /button.disabled = true/);
});
