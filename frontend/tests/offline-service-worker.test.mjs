import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const worker = await readFile(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8');
const generator = await readFile(new URL('../scripts/generate-offline-worker.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const updateService = await readFile(new URL('../src/services/pwaUpdateService.web.ts', import.meta.url), 'utf8');
const updatePrompt = await readFile(new URL('../src/components/PWAUpdatePrompt.tsx', import.meta.url), 'utf8');
const rootLayout = await readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8');

test('one root worker assigns push and notificationclick to WonderPush', () => {
  assert.match(worker, /cdn\.by\.wonderpush\.com\/sdk\/1\.1\/wonderpush-loader\.min\.js/);
  assert.doesNotMatch(worker, /addEventListener\(['"]push/);
  assert.doesNotMatch(worker, /addEventListener\(['"]notificationclick/);
});

test('IPM retains versioned shell and cache-first navigation ownership', () => {
  assert.match(worker, /IPM_OFFLINE_VERSION/);
  assert.match(worker, /IPM_SHELL_CACHE/);
  assert.match(worker, /cache\.match\(['"]\/index\.html['"]\)/);
  assert.match(worker, /if \(cached\) return cached/);
  assert.match(generator, /sha256/);
});

test('legacy Webpushr bell remains suppressed without loading its SDK', () => {
  assert.match(html, /#webpushr-bell-optin/);
  assert.doesNotMatch(html, /cdn\.webpushr\.com\/app\.min\.js/);
});

test('new and already-waiting workers surface one global update prompt', () => {
  assert.match(updateService, /registration\?\.waiting/);
  assert.match(updateService, /addEventListener\('updatefound', observeInstallingWorker\)/);
  assert.match(updateService, /candidate\.state === 'installed'/);
  assert.match(updateService, /candidate === waitingWorker/);
  assert.match(updatePrompt, /A new version of the IPM app is available\./);
  assert.match(rootLayout, /<PWAUpdatePrompt \/>/);
});

test('Update now activates the waiting worker and reloads exactly once after control changes', () => {
  assert.match(worker, /event\.data\?\.type === 'IPM_ACTIVATE_UPDATE'/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(updateService, /waitingWorker\.postMessage\(\{ type: ACTIVATE_UPDATE_MESSAGE \}\)/);
  assert.match(updateService, /addEventListener\('controllerchange'/);
  assert.match(updateService, /if \(!activationRequested \|\| reloadStarted\) return/);
  assert.match(updateService, /reloadStarted = true;[\s\S]*window\.location\.reload\(\)/);
  assert.match(updatePrompt, />Update now</);
});

test('current builds, first installs, and offline resumes do not prompt or reload', () => {
  assert.match(updateService, /if \(!candidate \|\| !navigator\.serviceWorker\.controller\) return/);
  assert.match(updateService, /if \(!registration \|\| navigator\.onLine === false \|\| updateCheck\) return/);
  assert.match(updatePrompt, /if \(Platform\.OS !== 'web' \|\| !available\) return null/);
  assert.doesNotMatch(updateService, /setInterval|setTimeout/);
});

test('app resume checks for updates without duplicate checks or reload loops', () => {
  assert.match(updateService, /window\.addEventListener\('focus', checkForUpdate\)/);
  assert.match(updateService, /document\.visibilityState === 'visible'/);
  assert.match(updateService, /window\.addEventListener\('online', checkForUpdate\)/);
  assert.match(updateService, /updateCheck = registration\.update\(\)/);
  assert.match(updateService, /if \(!waitingWorker \|\| activationRequested\) return/);
});

test('updates preserve itinerary and origin storage and retain one WonderPush worker', () => {
  assert.doesNotMatch(worker + updateService, /localStorage\.clear|AsyncStorage\.clear|indexedDB\.deleteDatabase/);
  assert.doesNotMatch(worker + updateService, /serviceWorker\.unregister|getRegistrations/);
  assert.match(worker, /IPM_CACHE_PREFIX/);
  assert.match(worker, /cdn\.by\.wonderpush\.com/);
  assert.equal((rootLayout.match(/initializeOfflineShell\(\)/g) || []).length, 1);
});
