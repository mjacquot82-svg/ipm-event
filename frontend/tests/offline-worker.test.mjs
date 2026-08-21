import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

import { buildOfflineWorker } from '../scripts/build-offline-worker.mjs';

const workerSource = await readFile(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8');
const layoutSource = await readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
const publicDirectory = new URL('../public/', import.meta.url);

function pngDimensions(contents) {
  const signature = contents.subarray(0, 8).toString('hex');
  assert.equal(signature, '89504e470d0a1a0a');
  assert.equal(contents.subarray(12, 16).toString('ascii'), 'IHDR');
  return `${contents.readUInt32BE(16)}x${contents.readUInt32BE(20)}`;
}

async function makeExport(suffix = 'a') {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ipm-worker-test-'));
  const files = {
    'index.html': `<script src="/_expo/static/js/web/entry-${suffix.repeat(32)}.js"></script>`,
    'manifest.json': '{}',
    'v2-icon.png': 'icon',
    'ipm-icon-any-192.png': 'icon-any-192',
    'ipm-icon-any-512.png': 'icon-any-512',
    'ipm-icon-maskable-192.png': 'icon-maskable-192',
    'ipm-icon-maskable-512.png': 'icon-maskable-512',
    'favicon.ico': 'favicon',
    [`_expo/static/js/web/entry-${suffix.repeat(32)}.js`]: `bundle-${suffix}`,
    [`assets/fonts/Feather.${suffix.repeat(32)}.ttf`]: 'feather',
    [`assets/fonts/MaterialCommunityIcons.${suffix.repeat(32)}.ttf`]: 'material',
    [`assets/images/field.${suffix.repeat(32)}.png`]: 'field',
    [`assets/images/gemini4.${suffix.repeat(32)}.png`]: 'gemini',
    [`assets/images/event-map.${suffix.repeat(32)}.png`]: 'map',
    'webpushr-sw.js': workerSource,
  };
  for (const [relative, contents] of Object.entries(files)) {
    const destination = path.join(directory, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }
  return directory;
}

function workerHarness(configuration) {
  const listeners = new Map();
  const imported = [];
  const deleted = [];
  const added = [];
  const cacheEntries = new Map([['/index.html', { kind: 'shell' }]]);
  const cache = {
    addAll: async (assets) => { added.push(...assets); },
    match: async (request) => cacheEntries.get(typeof request === 'string' ? request : new URL(request.url).pathname),
    put: async (request, response) => { cacheEntries.set(new URL(request.url).pathname, response); },
  };
  const caches = {
    open: async () => cache,
    keys: async () => ['ipm-app-shell-old', 'ipm-public-runtime-old', `ipm-app-shell-${configuration.version}`, 'webpushr-owned', 'unrelated'],
    delete: async (name) => { deleted.push(name); return true; },
    match: async (request) => cache.match(request),
  };
  const context = {
    URL,
    Promise,
    caches,
    fetch: async (request) => ({ ok: true, kind: 'network', request, clone() { return this; } }),
    importScripts: (url) => imported.push(url),
    self: {
      __IPM_OFFLINE_CONFIG__: configuration,
      location: { origin: 'https://ipm.test' },
      clients: { claim: async () => undefined },
      addEventListener(type, listener) {
        const values = listeners.get(type) || [];
        values.push(listener);
        listeners.set(type, values);
      },
    },
  };
  vm.runInNewContext(workerSource, context);
  return { context, listeners, imported, deleted, added, cacheEntries };
}

function dispatch(harness, type, event) {
  for (const listener of harness.listeners.get(type) || []) listener(event);
}

test('build injects a deterministic critical manifest and excludes Queen portraits', async (t) => {
  const directory = await makeExport('a');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = await buildOfflineWorker(directory);
  assert.equal(first.precacheAssets.length, 14);
  for (const expected of ['index.html', 'manifest.json', 'v2-icon.png', 'ipm-icon-any-192.png', 'ipm-icon-any-512.png', 'ipm-icon-maskable-192.png', 'ipm-icon-maskable-512.png', 'favicon.ico', 'entry-', 'Feather.', 'MaterialCommunityIcons.', 'field.', 'gemini4.', 'event-map.']) {
    assert.ok(first.precacheAssets.some((asset) => asset.includes(expected)), expected);
  }
  assert.ok(first.precacheAssets.every((asset) => !asset.includes('queen-of-the-furrow')));
  const generated = await readFile(path.join(directory, 'webpushr-sw.js'), 'utf8');
  assert.match(generated, new RegExp(`self\\.__IPM_OFFLINE_CONFIG__=.*${first.version}`));
  assert.match(generated, /importScripts\('https:\/\/cdn\.webpushr\.com\/sw-server\.min\.js'\)/);
});

test('manifest declares distinct, correctly sized any and maskable install icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', publicDirectory), 'utf8'));
  const expected = new Map([
    ['/ipm-icon-any-192.png', { sizes: '192x192', purpose: 'any' }],
    ['/ipm-icon-any-512.png', { sizes: '512x512', purpose: 'any' }],
    ['/ipm-icon-maskable-192.png', { sizes: '192x192', purpose: 'maskable' }],
    ['/ipm-icon-maskable-512.png', { sizes: '512x512', purpose: 'maskable' }],
  ]);

  assert.equal(manifest.icons.length, expected.size);
  for (const icon of manifest.icons) {
    const declaration = expected.get(icon.src);
    assert.ok(declaration, `unexpected manifest icon: ${icon.src}`);
    assert.deepEqual({ sizes: icon.sizes, purpose: icon.purpose }, declaration);
    assert.equal(icon.type, 'image/png');
    const contents = await readFile(new URL(icon.src.slice(1), publicDirectory));
    assert.equal(pngDimensions(contents), icon.sizes, icon.src);
  }
});

test('asset content changes produce a new cache version for safe upgrades', async (t) => {
  const firstDirectory = await makeExport('a');
  const secondDirectory = await makeExport('b');
  t.after(() => Promise.all([firstDirectory, secondDirectory].map((directory) => rm(directory, { recursive: true, force: true }))));
  const first = await buildOfflineWorker(firstDirectory);
  const second = await buildOfflineWorker(secondDirectory);
  assert.notEqual(first.version, second.version);
});

test('Variant B bypasses Webpushr only in a Netlify Deploy Preview', async (t) => {
  const directory = await makeExport('c');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const indexPath = path.join(directory, 'index.html');
  await writeFile(
    indexPath,
    `<script>(function(){var src='https://cdn.webpushr.com/app.min.js'})()</script>`
      + `<script src="/_expo/static/js/web/entry-${'c'.repeat(32)}.js"></script>`,
  );

  await assert.rejects(
    () => buildOfflineWorker(directory, { diagnosticVariant: 'B', deployContext: 'production' }),
    /restricted to Netlify Deploy Previews/,
  );
  await buildOfflineWorker(directory, { diagnosticVariant: 'B', deployContext: 'deploy-preview' });
  const generatedWorker = await readFile(path.join(directory, 'webpushr-sw.js'), 'utf8');
  const generatedIndex = await readFile(indexPath, 'utf8');
  assert.doesNotMatch(generatedWorker, /importScripts\(/);
  assert.match(generatedWorker, /TEMPORARY NETLIFY DEPLOY PREVIEW VARIANT B/);
  assert.doesNotMatch(generatedIndex, /cdn\.webpushr\.com/);
});

test('the one root worker preserves Webpushr and does not replace its push handlers', () => {
  assert.match(workerSource, /^importScripts\('https:\/\/cdn\.webpushr\.com\/sw-server\.min\.js'\);/);
  assert.doesNotMatch(workerSource, /addEventListener\(['"](?:push|notificationclick|notificationclose|message)['"]/);
  assert.match(layoutSource, /navigator\.serviceWorker\.register\('\/webpushr-sw\.js', \{ scope: '\/' \}\)/);
  assert.equal((layoutSource.match(/navigator\.serviceWorker\.register/g) || []).length, 1);
  assert.match(layoutSource, /window\.webpushr\('setup'/);
});

test('install precaches only the generated critical assets', async () => {
  const config = { version: 'version-b', precacheAssets: ['/index.html', '/bundle.js', '/event-map.png'] };
  const harness = workerHarness(config);
  assert.deepEqual(harness.imported, ['https://cdn.webpushr.com/sw-server.min.js']);
  let work;
  dispatch(harness, 'install', { waitUntil(value) { work = value; } });
  await work;
  assert.deepEqual(harness.added, config.precacheAssets);
});

test('activation removes only obsolete IPM-owned caches', async () => {
  const harness = workerHarness({ version: 'version-b', precacheAssets: ['/index.html'] });
  let work;
  dispatch(harness, 'activate', { waitUntil(value) { work = value; } });
  await work;
  assert.deepEqual(harness.deleted.sort(), ['ipm-app-shell-old', 'ipm-public-runtime-old']);
});

test('same-origin attendee navigation falls back to the cached shell', async () => {
  const harness = workerHarness({ version: 'v1', precacheAssets: ['/index.html'] });
  harness.context.fetch = async () => { throw new TypeError('offline'); };
  let response;
  dispatch(harness, 'fetch', {
    request: { method: 'GET', mode: 'navigate', url: 'https://ipm.test/schedule' },
    respondWith(value) { response = value; },
  });
  assert.deepEqual(await response, { kind: 'shell' });
});

test('API, write, and external requests are never intercepted', () => {
  const harness = workerHarness({ version: 'v1', precacheAssets: ['/index.html'] });
  for (const request of [
    { method: 'GET', mode: 'cors', url: 'https://ipm.test/api/schedule' },
    { method: 'POST', mode: 'cors', url: 'https://ipm.test/api/activity/events' },
    { method: 'GET', mode: 'cors', url: 'https://cdn.webpushr.com/app.min.js' },
    { method: 'GET', mode: 'cors', url: 'https://external.test/file.js' },
  ]) {
    let intercepted = false;
    dispatch(harness, 'fetch', { request, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, request.url);
  }
});

test('critical static assets are cache-first and include the Map', async () => {
  const mapPath = '/assets/assets/images/event-map.hash.png';
  const harness = workerHarness({ version: 'v1', precacheAssets: ['/index.html', mapPath] });
  harness.cacheEntries.set(mapPath, { kind: 'cached-map' });
  let response;
  dispatch(harness, 'fetch', {
    request: { method: 'GET', mode: 'no-cors', url: `https://ipm.test${mapPath}` },
    respondWith(value) { response = value; },
  });
  assert.deepEqual(await response, { kind: 'cached-map' });
});

test('Queen portraits cache after a successful view and failures do not affect shell installation', async () => {
  const harness = workerHarness({ version: 'v1', precacheAssets: ['/index.html'] });
  const queenUrl = 'https://ipm.test/assets/assets/images/queen-of-the-furrow/example.hash.jpg';
  let response;
  dispatch(harness, 'fetch', {
    request: { method: 'GET', mode: 'no-cors', url: queenUrl },
    respondWith(value) { response = value; },
  });
  assert.equal((await response).kind, 'network');
  assert.equal(harness.cacheEntries.get(new URL(queenUrl).pathname).kind, 'network');

  harness.context.fetch = async () => { throw new TypeError('optional image offline'); };
  let failed;
  dispatch(harness, 'fetch', {
    request: { method: 'GET', mode: 'no-cors', url: queenUrl.replace('example', 'other') },
    respondWith(value) { failed = value; },
  });
  await assert.rejects(() => failed, /optional image offline/);
  assert.ok(harness.cacheEntries.has('/index.html'));
});
