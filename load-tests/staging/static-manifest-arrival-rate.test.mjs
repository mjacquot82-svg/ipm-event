import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateManifestResponse, validateTarget } from './manifest-validation.js';

const scriptPath = new URL('./static-manifest-arrival-rate.js', import.meta.url);
const source = fs.readFileSync(scriptPath, 'utf8');
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

test('valid staging manifest is accepted and establishes immutable baseline', () => {
  const result = validateManifestResponse(parseResponse(valid()));
  assert.equal(result.ok, true);
  assert.deepEqual(result.baseline, { scheduleRevision: 'schedule-a', announcementsRevision: 'announcements-a' });
});

for (const [name, body, reason] of [
  ['wrong environment', { environment: 'production', event: 'ipm-staging', schedule: { revision: 'a' }, announcements: { revision: 'b' } }, 'wrong environment'],
  ['wrong event', { environment: 'staging', event: 'ipm', schedule: { revision: 'a' }, announcements: { revision: 'b' } }, 'wrong event'],
  ['SPA HTML', '<!doctype html><html></html>', 'response is not valid JSON'],
]) {
  test(`${name} is rejected`, () => {
    const response = typeof body === 'string' ? { ...valid(), body } : { ...valid(), body: JSON.stringify(body) };
    assert.equal(validateManifestResponse(parseResponse(response)).reason, reason);
  });
}

test('changed revision is rejected against setup baseline', () => {
  const baseline = { scheduleRevision: 'schedule-a', announcementsRevision: 'announcements-a' };
  const response = parseResponse(valid({ schedule: { revision: 'schedule-b' } }));
  assert.equal(validateManifestResponse(response, baseline).reason, 'manifest revision changed');
});

test('exact target guard rejects production, HTTP, ports, queries, fragments and overrides', () => {
  assert.deepEqual(validateTarget('https://staging.theipm.ca/content-manifest.json'), { ok: true });
  for (const target of [
    'https://theipm.ca/content-manifest.json',
    'http://staging.theipm.ca/content-manifest.json',
    'https://staging.theipm.ca:443/content-manifest.json',
    'https://staging.theipm.ca/content-manifest.json?x=1',
    'https://staging.theipm.ca/content-manifest.json#x',
    'https://staging.theipm.ca/other.json',
    'https://ipm-backend-eoiw.onrender.com/content-manifest.json',
    'https://hppboivlpqkfhhzfftuu.supabase.co/content-manifest.json',
  ]) assert.equal(validateTarget(target).ok, false, target);
  assert.equal(validateTarget('https://staging.theipm.ca/content-manifest.json', { TARGET_URL: 'https://theipm.ca' }).ok, false);
});

test('arrival script has no dangerous endpoints and exactly one load GET plus setup GET', () => {
  for (const path of ['/api/schedule', '/api/announcements', '/api/vendors', '/admin', '/organizer', '/sos', 'WonderPush', 'Expo', 'T-30', 'migrations']) {
    assert.equal(source.includes(path), false, `unexpected dangerous path: ${path}`);
  }
  assert.equal((source.match(/http\.get\(/g) || []).length, 2);
  assert.equal(source.includes('sleep('), false);
  assert.match(source, /executor: 'constant-arrival-rate'/);
});

test('all supported rates and worker allocations are exactly configured', () => {
  for (const [name, rate, pre, max] of [
    ['RATE_22', 22, 25, 50], ['RATE_44', 44, 25, 50], ['RATE_111', 111, 25, 50],
    ['RATE_222', 222, 25, 50], ['RATE_333', 333, 40, 80],
  ]) {
    assert.match(source, new RegExp(`${name}: \\{ rate: ${rate}, preAllocatedVUs: ${pre}, maxVUs: ${max} \\}`));
  }
  assert.match(source, /duration: '5m'/);
  assert.match(source, /dropped_iterations: \['count==0'\]/);
  assert.match(source, /http_req_duration: \['p\(95\)<100'\]/);
});
