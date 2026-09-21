import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = await readFile(new URL('../src/services/spreadsheetDataService.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
} }).outputText;
const jwt = { code: 'PGRST303', message: 'JWT issued at future' };
const payload = (type, revision = 7) => ({
  [type === 'schedule' ? 'events' : 'announcements']: [{ id: '12345678-1234-4234-8234-123456789abc', title: `revision ${revision}` }],
  content_revision: revision, total_count: 1, last_updated: '2026-09-21T00:00:00Z',
});
const manifest = revision => ({ environment: 'production', event: 'ipm-2026',
  schedule: { revision }, announcements: { revision },
});

function harness(type, warm = true) {
  let now = Date.parse('2026-09-21T12:00:00Z');
  const key = `ipm_supabase_cache:v2:https_ipm_backend_eoiw_onrender_com:${type}`;
  const entries = new Map();
  if (warm) entries.set(key, JSON.stringify({ data: payload(type), contentRevision: 7,
    lastSuccessfulUpdate: '2026-09-20T00:00:00Z', cacheAge: 0 }));
  const writes = [], deletes = [], calls = [], sleeps = [];
  const h = { entries, writes, deletes, calls, sleeps, key,
    advance: () => { now += 30_001; },
    manifest: async () => new Response(JSON.stringify(manifest(7))),
    backend: async () => new Response(JSON.stringify(jwt), { status: 401 }),
  };
  const exports = {};
  const storage = {
    getItem: async key => entries.get(key) ?? null,
    setItem: async (key, value) => { writes.push(key); entries.set(key, value); },
    removeItem: async key => { deletes.push(key); entries.delete(key); },
  };
  vm.runInNewContext(compiled, {
    exports, require: name => {
      if (name === '@react-native-async-storage/async-storage') return storage;
      if (name === 'react-native') return { Platform: { OS: 'web' } };
      throw Error(`Unexpected dependency ${name}`);
    },
    process: { env: {} }, URL, AbortController,
    Date: class extends Date { static now() { return now; } },
    console: { error() {}, warn() {} },
    setTimeout: (fn, ms) => { if (ms === 1500) { sleeps.push(ms); queueMicrotask(fn); } return 1; },
    clearTimeout() {},
    fetch: async url => { calls.push(url); return url === '/content-manifest.json' ? h.manifest() : h.backend(); },
  });
  h.load = exports[type === 'schedule' ? 'getScheduleData' : 'getAnnouncementsData'];
  h.fullReads = () => calls.filter(url => url.includes('/api/')).length;
  h.background = async () => {
    let complete;
    const done = new Promise(resolve => { complete = resolve; });
    const initial = await h.load({ onBackgroundRefresh: result => complete({ result }),
      onBackgroundRefreshError: error => complete({ error }) });
    return { initial, done };
  };
  return h;
}

for (const type of ['schedule', 'announcements']) {
  test(`${type}: cold JWT exhaustion has finite retries, no cache or false offline result, later recovers`, async () => {
    const h = harness(type, false);
    await assert.rejects(h.load(), /status 401/);
    assert.equal(h.fullReads(), 3);
    assert.deepEqual(h.sleeps, [1500, 1500]);
    assert.equal(h.entries.size, 0);
    assert.equal(h.writes.length, 0);
    for (let i = 0; i < 10; i++) await assert.rejects(h.load(), /status 401/);
    assert.equal(h.fullReads(), 3);
    h.advance();
    h.backend = async () => new Response(JSON.stringify(payload(type)));
    const result = await h.load();
    assert.equal(result.source, 'network');
    assert.equal(JSON.parse(h.entries.get(h.key)).contentRevision, 7);
  });

  test(`${type}: cold transient JWT errors recover within the initial bounded request`, async () => {
    const h = harness(type, false);
    h.backend = async () => h.fullReads() < 3
      ? new Response(JSON.stringify(jwt), { status: 401 })
      : new Response(JSON.stringify(payload(type)));
    assert.equal((await h.load()).source, 'network');
    assert.equal(h.fullReads(), 3);
    assert.equal(h.writes.length, 1);
  });

  test(`${type}: warm cache returns before manifest resolves; unchanged revision makes zero full reads during JWT outage`, async () => {
    const h = harness(type);
    const saved = h.entries.get(h.key);
    let finish;
    h.manifest = () => new Promise(resolve => { finish = resolve; });
    const { initial, done } = await h.background();
    assert.equal(initial.source, 'cache');
    assert.equal(initial.data.content_revision, 7);
    finish(new Response(JSON.stringify(manifest(7))));
    assert.equal((await done).result.contentRevision, 7);
    assert.equal(h.fullReads(), 0);
    assert.equal(h.entries.get(h.key), saved);
    assert.equal(h.writes.length, 0);
  });

  test(`${type}: failed revision lookup preserves bytes and repeated focus/reconnect calls cannot trigger full reads`, async () => {
    const h = harness(type);
    const saved = h.entries.get(h.key);
    h.manifest = async () => new Response(JSON.stringify(jwt), { status: 401 });
    const { initial, done } = await h.background();
    assert.equal(initial.source, 'cache');
    assert.match((await done).error.message, /Manifest request failed/);
    for (let i = 0; i < 10; i++) {
      const { initial, done } = await h.background();
      assert.equal(initial.source, 'cache');
      await done;
    }
    assert.equal(h.calls.length, 1);
    assert.equal(h.fullReads(), 0);
    assert.equal(h.entries.get(h.key), saved);
    assert.equal(h.writes.length, 0);
    assert.ok(!h.deletes.includes(h.key));
    h.advance();
    h.manifest = async () => new Response(JSON.stringify(manifest(7)));
    assert.ok((await (await h.background()).done).result);
  });

  test(`${type}: changed revision JWT failure retains visible cache and later successful refresh commits new revision`, async () => {
    const h = harness(type);
    const saved = h.entries.get(h.key);
    h.manifest = async () => new Response(JSON.stringify(manifest(8)));
    const { initial, done } = await h.background();
    assert.equal(initial.data.content_revision, 7);
    assert.match((await done).error.message, /status 401/);
    assert.equal(h.fullReads(), 3);
    assert.equal(h.entries.get(h.key), saved);
    assert.equal(h.writes.length, 0);
    for (let i = 0; i < 10; i++) await (await h.background()).done;
    assert.equal(h.fullReads(), 3);
    h.advance();
    h.backend = async () => new Response(JSON.stringify(payload(type, 8)));
    const retry = await h.background();
    assert.equal(retry.initial.data.content_revision, 7);
    assert.equal((await retry.done).result.contentRevision, 8);
    assert.equal(JSON.parse(h.entries.get(h.key)).contentRevision, 8);
    assert.equal(h.writes.length, 1);
  });

  test(`${type}: revision mismatch, partial body, invalid data and rollback never overwrite cache`, async () => {
    for (const failure of ['mismatch', 'partial', 'invalid', 'rollback', 'manual-rollback']) {
      const h = harness(type);
      const saved = h.entries.get(h.key);
      h.manifest = async () => new Response(JSON.stringify(manifest(failure === 'rollback' ? 6 : 8)));
      h.backend = async () => new Response(failure === 'partial' ? '{"events":[' : JSON.stringify(
        failure === 'invalid' ? jwt : payload(type, failure === 'manual-rollback' ? 6 : 9)));
      if (failure === 'manual-rollback') await assert.rejects(h.load({ preferCache: false }), /rollback/);
      else assert.ok((await (await h.background()).done).error);
      assert.equal(h.entries.get(h.key), saved, failure);
      assert.equal(h.writes.length, 0, failure);
    }
  });

  test(`${type}: concurrent cold consumers share one bounded retry sequence`, async () => {
    const h = harness(type, false);
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => h.load()));
    assert.ok(results.every(result => result.status === 'rejected'));
    assert.equal(h.fullReads(), 3);
  });
}
