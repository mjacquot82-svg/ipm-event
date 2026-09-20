import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateManifestResponse, validateTarget } from './manifest-validation.js';

const valid = (overrides = {}) => ({
  status: 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    environment: 'staging', event: 'ipm-staging',
    schedule: { revision: 'schedule-a' }, announcements: { revision: 'announcements-a' },
    ...overrides,
  }),
});
const parseResponse = (response) => ({ ...response, json() { return JSON.parse(this.body); } });

test('valid staging manifest is accepted and establishes baseline', () => {
  const result = validateManifestResponse(parseResponse(valid()));
  assert.equal(result.ok, true);
  assert.deepEqual(result.baseline, { scheduleRevision: 'schedule-a', announcementsRevision: 'announcements-a' });
});

for (const [name, body, reason] of [
  ['SPA HTML', '<!doctype html><html></html>', 'response is not valid JSON'],
  ['wrong environment', { environment: 'production', event: 'ipm-staging', schedule: { revision: 'a' }, announcements: { revision: 'b' } }, 'wrong environment'],
  ['wrong event', { environment: 'staging', event: 'ipm', schedule: { revision: 'a' }, announcements: { revision: 'b' } }, 'wrong event'],
  ['missing revisions', { environment: 'staging', event: 'ipm-staging', schedule: {}, announcements: {} }, 'missing schedule revision'],
  ['missing announcements revision', { environment: 'staging', event: 'ipm-staging', schedule: { revision: 'a' }, announcements: {} }, 'missing announcements revision'],
]) {
  test(`${name} is rejected`, () => {
    const response = typeof body === 'string' ? { ...valid(), body } : { ...valid(), body: JSON.stringify(body) };
    assert.equal(validateManifestResponse(parseResponse(response)).reason, reason);
  });
}

test('revision changes during test are rejected', () => {
  const baseline = { scheduleRevision: 'schedule-a', announcementsRevision: 'announcements-a' };
  const response = parseResponse(valid({ schedule: { revision: 'schedule-b' } }));
  assert.equal(validateManifestResponse(response, baseline).reason, 'manifest revision changed');
});

test('production target and overrides are rejected', () => {
  assert.equal(validateTarget('https://theipm.ca/content-manifest.json').ok, false);
  assert.equal(validateTarget('https://staging.theipm.ca/content-manifest.json', { TARGET_URL: 'https://theipm.ca' }).ok, false);
});

test('target guard works when the global URL constructor is unavailable', () => {
  const originalURL = globalThis.URL;
  try {
    globalThis.URL = undefined;
    assert.deepEqual(validateTarget('https://staging.theipm.ca/content-manifest.json'), { ok: true });
    for (const target of [
      'http://staging.theipm.ca/content-manifest.json',
      'https://staging.theipm.ca:443/content-manifest.json',
      'https://staging.theipm.ca/content-manifest.json?x=1',
      'https://staging.theipm.ca/content-manifest.json#x',
      'https://staging.theipm.ca/other.json',
      'https://theipm.ca/content-manifest.json',
      'https://ipm-backend-eoiw.onrender.com/content-manifest.json',
      'https://hppboivlpqkfhhzfftuu.supabase.co/content-manifest.json',
    ]) assert.equal(validateTarget(target).ok, false, target);
  } finally {
    globalThis.URL = originalURL;
  }
});

test('script contains only the static manifest request and no dangerous endpoint paths', () => {
  const source = fs.readFileSync(new URL('./returning-user-static-manifest.js', import.meta.url), 'utf8');
  for (const path of ['/api/schedule', '/api/announcements', '/api/vendors', '/admin', '/organizer', '/sos', 'WonderPush', 'Expo', 'T-30', 'migrations']) {
    assert.equal(source.includes(path), false, `unexpected dangerous path: ${path}`);
  }
  assert.equal((source.match(/http\.get\(/g) || []).length, 2, 'setup plus VU manifest GET only');
});
