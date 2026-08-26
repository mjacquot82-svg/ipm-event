import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadWorker() {
  const source = await readFile(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8');
  const listeners = new Map();
  const deleted = [];
  let skipWaitingCalls = 0;
  let precached = null;
  const cachedShell = new Response('<html>offline</html>');
  const cache = {
    addAll: async (assets) => { precached = assets; },
    match: async (request) => String(request).includes('index.html') ? cachedShell : null,
  };
  const sandbox = {
    URL, Response, console,
    importScripts: (url) => { sandbox.imported = url; },
    fetch: async () => { throw new Error('offline'); },
    caches: {
      open: async () => cache,
      keys: async () => ['unrelated-cache', 'ipm-offline-shell-old', 'ipm-offline-shell-development'],
      delete: async (key) => { deleted.push(key); return true; },
      match: async () => null,
    },
  };
  sandbox.self = {
    location: { href: 'https://staging.example/webpushr-sw.js?webKey=test-key', origin: 'https://staging.example' },
    WonderPush: [],
    clients: { claim: async () => undefined },
    skipWaiting: async () => { skipWaitingCalls += 1; },
    addEventListener: (name, handler) => listeners.set(name, handler),
  };
  vm.runInNewContext(source, sandbox);
  return { source, listeners, sandbox, deleted, getPrecached: () => precached,
    getSkipWaitingCalls: () => skipWaitingCalls };
}

test('one root worker initializes WonderPush and adds offline lifecycle handlers', async () => {
  const worker = await loadWorker();
  assert.match(worker.sandbox.imported, /cdn\.by\.wonderpush\.com/);
  assert.deepEqual(Array.from(worker.listeners.keys()).sort(), ['activate', 'fetch', 'install', 'message']);
  assert.doesNotMatch(worker.source, /addEventListener\(['"](?:push|notificationclick)['"]/);
  assert.equal(worker.sandbox.self.WonderPush.length, 1);
});

test('app explicitly registers the same root worker even before notification opt-in', async () => {
  const [service, layout] = await Promise.all([
    readFile(new URL('../src/services/wonderPushService.web.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(service, /navigator\.serviceWorker\.register\(getWonderPushWorkerUrl\(webKey\)/);
  assert.match(service, /scope: '\/'/);
  assert.match(service, /updateViaCache: 'none'/);
  assert.match(layout, /initializeOfflineShell\(\)/);
});

test('install precaches shell and activation removes only obsolete IPM caches', async () => {
  const worker = await loadWorker();
  let install;
  worker.listeners.get('install')({ waitUntil: (promise) => { install = promise; } });
  await install;
  assert.deepEqual(Array.from(worker.getPrecached()), ['/', '/index.html', '/manifest.json']);
  assert.deepEqual(worker.deleted, [], 'old working cache must survive until activation');
  let activate;
  worker.listeners.get('activate')({ waitUntil: (promise) => { activate = promise; } });
  await activate;
  assert.deepEqual(worker.deleted, ['ipm-offline-shell-old']);
});

test('waiting worker reports its offline version and activates only after explicit action', async () => {
  const worker = await loadWorker();
  let status;
  worker.listeners.get('message')({
    data: { type: 'IPM_GET_OFFLINE_STATUS' },
    ports: [{ postMessage: (value) => { status = value; } }],
  });
  assert.equal(status.shellVersion, 'development');
  assert.equal(worker.getSkipWaitingCalls(), 0);
  worker.listeners.get('message')({ data: { type: 'IPM_ACTIVATE_WAITING_UPDATE' }, ports: [] });
  await Promise.resolve();
  assert.equal(worker.getSkipWaitingCalls(), 1);
});

test('offline navigation falls back to the cached application shell', async () => {
  const worker = await loadWorker();
  let response;
  worker.listeners.get('fetch')({
    request: { method: 'GET', mode: 'navigate', url: 'https://staging.example/schedule' },
    respondWith: (promise) => { response = promise; },
  });
  assert.equal(await (await response).text(), '<html>offline</html>');
});

test('worker generator selects core shell assets without large content archives', async () => {
  const source = await readFile(new URL('../scripts/generate-offline-worker.js', import.meta.url), 'utf8');
  assert.match(source, /\(js\|css\|woff2\?\)/);
  assert.match(source, /Feather\|MaterialCommunityIcons/);
  assert.match(source, /event-map/);
  assert.match(source, /gemini4/);
  assert.doesNotMatch(source, /queen-of-the-furrow/);
  assert.match(source, /createHash\('sha256'\)/);
});
