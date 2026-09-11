import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const worker = await readFile(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8');
const generator = await readFile(new URL('../scripts/generate-offline-worker.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('one root worker assigns push and notificationclick to WonderPush', () => {
  assert.match(worker, /cdn\.by\.wonderpush\.com\/sdk\/1\.1\/wonderpush-loader\.min\.js/);
  assert.doesNotMatch(worker, /addEventListener\(['"]push/);
  assert.doesNotMatch(worker, /addEventListener\(['"]notificationclick/);
});

test('IPM retains versioned shell and bounded network-first navigation ownership', () => {
  assert.match(worker, /IPM_OFFLINE_VERSION/);
  assert.match(worker, /IPM_SHELL_CACHE/);
  assert.match(worker, /cache\.match\(['"]\/index\.html['"]\)/);
  assert.match(worker, /if \(cached\) return cached/);
  assert.match(worker, /event\.respondWith\(currentLaunch\(request\)\)/);
  assert.match(worker, /IPM_LAUNCH_TIMEOUT_MS = 5000/);
  assert.doesNotMatch(worker, /if \(cached\) return cached;\s*\n\s*return fetch\(request\)/);
  assert.match(generator, /sha256/);
});

test('legacy Webpushr bell remains suppressed without loading its SDK', () => {
  assert.match(html, /#webpushr-bell-optin/);
  assert.doesNotMatch(html, /cdn\.webpushr\.com\/app\.min\.js/);
});

test('production launch freshness omits foreground update activation', async () => {
  const layout = await readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /startPwaUpdateFlow|setPwaUpdateSafeState/);
  assert.match(layout, /initializeOfflineShell\(\)/);
  assert.doesNotMatch(worker, /self\.skipWaiting|addEventListener\(['"]message/);
});
