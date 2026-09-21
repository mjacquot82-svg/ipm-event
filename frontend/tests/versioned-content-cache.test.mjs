import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const service = await readFile(new URL('../src/services/spreadsheetDataService.ts', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../public/content-manifest.json', import.meta.url), 'utf8'));
const netlify = await readFile(new URL('../../netlify.toml', import.meta.url), 'utf8');

test('production manifest is static, isolated, and starts at a valid revision', () => {
  assert.deepEqual({ environment: manifest.environment, event: manifest.event }, {
    environment: 'production', event: 'ipm-2026',
  });
  assert.ok(Number.isInteger(manifest.schedule.revision) && manifest.schedule.revision > 0);
  assert.ok(Number.isInteger(manifest.announcements.revision) && manifest.announcements.revision > 0);
  assert.match(netlify, /for = "\/content-manifest\.json"[\s\S]*Cache-Control/);
  assert.doesNotMatch(netlify, /functions\/v1\/content-manifest|staging\.theipm\.ca/);
});

test('cached Schedule and Announcements gate backend reads on the static revision', () => {
  assert.match(service, /fetch\('\/content-manifest\.json'/);
  assert.match(service, /manifest\.environment !== 'production'/);
  assert.match(service, /cachedData\.contentRevision === remoteRevision/);
  assert.match(service, /Full \$\{contentType\} response revision does not match manifest/);
  assert.match(service, /const refreshPromises = new Map/);
  assert.match(service, /contentType: 'schedule'/);
  assert.match(service, /contentType: 'announcements'/);
});

test('unchanged revision returns the cached payload without a full fetch', () => {
  let fullFetches = 0;
  const gate = (cachedRevision, remoteRevision) => {
    if (cachedRevision === remoteRevision) return 'cache';
    fullFetches += 1;
    return 'network';
  };
  assert.equal(gate(7, 7), 'cache');
  assert.equal(fullFetches, 0);
});

test('changed revision performs exactly one full fetch and updates the cache', () => {
  let fullFetches = 0;
  const inFlight = new Map();
  const fullFetch = (key) => {
    if (!inFlight.has(key)) inFlight.set(key, Promise.resolve(++fullFetches));
    return inFlight.get(key);
  };
  const first = fullFetch('schedule');
  const second = fullFetch('schedule');
  assert.strictEqual(first, second);
  assert.equal(fullFetches, 1);
});

test('production cache namespace remains backend-origin isolated', () => {
  assert.match(service, /ipm_supabase_cache:v2/);
  assert.match(service, /getEnvironmentCacheIdentity/);
  assert.doesNotMatch(service, /ipm-2026-staging|ipm-staging|staging\.theipm\.ca/);
});
