import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const worker = await readFile(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8');
const generator = await readFile(new URL('../scripts/generate-offline-worker.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const updateService = await readFile(new URL('../src/services/pwaUpdateService.web.ts', import.meta.url), 'utf8');
const updatePrompt = await readFile(new URL('../src/components/PWAUpdatePrompt.tsx', import.meta.url), 'utf8');
const layout = await readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8');

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
  assert.match(generator, /sha256/);
});

test('legacy Webpushr bell remains suppressed without loading its SDK', () => {
  assert.match(html, /#webpushr-bell-optin/);
  assert.doesNotMatch(html, /cdn\.webpushr\.com\/app\.min\.js/);
});

test('staging root wires resume-update prompt without forced bootstrap reload', () => {
  assert.match(layout, /initializeOfflineShell\(\)/);
  assert.match(layout, /startPwaUpdateFlow\(registration\)/);
  assert.match(layout, /<PWAUpdatePrompt \/>/);
  assert.doesNotMatch(updateService, /setInterval/);
  assert.doesNotMatch(updateService, /UPDATE_CHECK_INTERVAL/);
  assert.match(updateService, /BACKGROUND_THRESHOLD_MS = 10 \* 60 \* 1000/);
});

test('SW skipWaiting is only reachable from the explicit activate message', () => {
  assert.match(worker, /event\.data\?\.type === 'IPM_ACTIVATE_UPDATE'/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.doesNotMatch(worker, /addEventListener\(['"]install['"][\s\S]*skipWaiting/);
  assert.equal((worker.match(/self\.skipWaiting\(\)/g) || []).length, 1);
});

test('prompt copy and Refresh/Later actions are user-controlled', () => {
  assert.match(updatePrompt, /IPM app update available/);
  assert.match(updatePrompt, /Refresh to get the latest maps, schedule and app improvements\./);
  assert.match(updatePrompt, />Refresh</);
  assert.match(updatePrompt, />Later</);
  assert.match(updateService, /activatePwaUpdate/);
  assert.match(updateService, /dismissPwaUpdate/);
  assert.match(updateService, /postMessage\(\{ type: ACTIVATE_UPDATE_MESSAGE \}\)/);
});

test('WonderPush bootstrap remains the sole push owner and generator stays intact', () => {
  assert.ok(worker.trimStart().startsWith('try {'));
  assert.match(worker, /importScripts\('https:\/\/cdn\.by\.wonderpush\.com\/sdk\/1\.1\/wonderpush-loader\.min\.js'\)/);
  assert.match(generator, /public['"], ['"]webpushr-sw\.js['"]/);
  assert.match(generator, /IPM_OFFLINE_VERSION/);
  assert.doesNotMatch(worker + updateService, /localStorage\.clear|AsyncStorage\.clear|indexedDB\.deleteDatabase/);
});
