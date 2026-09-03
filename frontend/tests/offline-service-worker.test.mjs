import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const worker = await readFile(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8');
const generator = await readFile(new URL('../scripts/generate-offline-worker.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const updateService = await readFile(new URL('../src/services/pwaUpdateService.web.ts', import.meta.url), 'utf8');
const rootLayout = await readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8');

test('one root worker assigns push and notificationclick to WonderPush', () => {
  assert.match(worker, /cdn\.by\.wonderpush\.com\/sdk\/1\.1\/wonderpush-loader\.min\.js/);
  assert.doesNotMatch(worker, /addEventListener\(['"]push/);
  assert.doesNotMatch(worker, /addEventListener\(['"]notificationclick/);
});

test('IPM retains versioned shell and navigation ownership with fresh admin login', () => {
  assert.match(worker, /IPM_OFFLINE_VERSION/);
  assert.match(worker, /IPM_SHELL_CACHE/);
  assert.match(worker, /cache\.match\(['"]\/index\.html['"]\)/);
  assert.match(worker, /if \(cached\) return cached/);
  assert.match(worker, /url\.pathname === IPM_ADMIN_LOGIN_PATH[\s\S]*return await fetch\(request\)/);
  assert.match(generator, /sha256/);
});

test('legacy Webpushr bell remains suppressed without loading its SDK', () => {
  assert.match(html, /#webpushr-bell-optin/);
  assert.doesNotMatch(html, /cdn\.webpushr\.com\/app\.min\.js/);
});

test('new and already-waiting workers are discovered without a manual update prompt', () => {
  assert.match(updateService, /registration\?\.waiting/);
  assert.match(updateService, /addEventListener\('updatefound', handleUpdateFound\)/);
  assert.match(updateService, /candidate\.state === 'installed'/);
  assert.match(updateService, /candidate === waitingWorker/);
  assert.doesNotMatch(rootLayout, /PWAUpdatePrompt|Update now/);
});

test('safe Home state activates the waiting worker and reloads exactly once after control changes', () => {
  assert.match(worker, /event\.data\?\.type === 'IPM_ACTIVATE_UPDATE'/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(updateService, /waitingWorker\.postMessage\(\{ type: ACTIVATE_UPDATE_MESSAGE \}\)/);
  assert.match(rootLayout, /setPwaUpdateSafeState\(pathname === '\/' \|\| pathname === '\/admin\/login'\)/);
  assert.match(updateService, /addEventListener\('controllerchange'/);
  assert.match(updateService, /if \(!activationRequested \|\| reloadStarted\) return/);
  assert.match(updateService, /reloadStarted = true;[\s\S]*window\.location\.reload\(\)/);
});

test('first installs and already-current builds do not activate or reload', () => {
  assert.match(updateService, /if \(!candidate \|\| !navigator\.serviceWorker\.controller\) return/);
  assert.match(updateService, /if \(!safeToActivate \|\| !waitingWorker \|\| activationRequested\) return/);
  assert.doesNotMatch(updateService, /setTimeout/);
});

test('safe resume checks, activates once, and offline checks remain suppressed', () => {
  assert.match(updateService, /window\.addEventListener\('focus', resumeUpdateFlow\)/);
  assert.match(updateService, /document\.visibilityState === 'visible'[\s\S]*resumeUpdateFlow\(\)/);
  assert.match(updateService, /window\.addEventListener\('online', resumeUpdateFlow\)/);
  assert.match(updateService, /window\.addEventListener\('pageshow', resumeUpdateFlow\)/);
  assert.match(updateService, /UPDATE_CHECK_INTERVAL_MS = 45_000/);
  assert.match(updateService, /setInterval\(checkForUpdate, UPDATE_CHECK_INTERVAL_MS\)/);
  assert.match(updateService, /updateCheck = registration\.update\(\)/);
  assert.match(updateService, /if \(!registration[\s\S]*navigator\.onLine === false[\s\S]*document\.visibilityState !== 'visible'[\s\S]*updateCheck\) return/);
  assert.match(updateService, /if \(!safeToActivate \|\| !waitingWorker \|\| activationRequested\) return/);
});

test('foreground scheduler stops for unsafe, hidden, offline, and disposed states', () => {
  assert.match(updateService, /safeToActivate[\s\S]*!activationRequested[\s\S]*navigator\.onLine !== false[\s\S]*document\.visibilityState === 'visible'/);
  assert.match(updateService, /window\.addEventListener\('offline', handleOffline\)/);
  assert.match(updateService, /else stopUpdateScheduler\(\)/);
  assert.match(updateService, /export function disposePwaUpdateFlow\(\)[\s\S]*stopUpdateScheduler\(\)/);
});

test('bounded local diagnostics cover the update and activation lifecycle', () => {
  for (const event of [
    'update_check_started', 'update_check_completed', 'update_found', 'worker_installing',
    'worker_waiting', 'activation_requested', 'controller_changed', 'reload_started',
  ]) assert.match(updateService, new RegExp(`recordDiagnostic\\('${event}'\\)`));
  assert.match(updateService, /MAX_DIAGNOSTICS = 24/);
  assert.doesNotMatch(updateService, /queueAnalyticsEvent|fetch\(/);
});

test('Emergency Services and authenticated flows defer activation until a safe route', () => {
  assert.match(rootLayout, /setPwaUpdateSafeState\(pathname === '\/' \|\| pathname === '\/admin\/login'\)/);
  assert.doesNotMatch(rootLayout, /emergency-services.*setPwaUpdateSafeState|itinerary.*setPwaUpdateSafeState|schedule.*setPwaUpdateSafeState/);
  assert.match(updateService, /safeToActivate = isSafe;[\s\S]*activateWaitingWorkerIfSafe\(\)/);
  assert.match(updateService, /waitingWorker = candidate;[\s\S]*activateWaitingWorkerIfSafe\(\)/);
});

test('an already-stale admin login receives a one-time bootstrap recovery', () => {
  assert.match(worker, /IPM_ADMIN_BOOTSTRAP_RECOVERY_CACHE = 'ipm-admin-bootstrap-recovery-v1'/);
  assert.match(worker, /isApplicationUpdate[\s\S]*!existingCacheKeys\.includes\(IPM_ADMIN_BOOTSTRAP_RECOVERY_CACHE\)/);
  assert.match(worker, /needsAdminBootstrapRecovery[\s\S]*await self\.skipWaiting\(\)/);
  assert.match(worker, /await caches\.open\(IPM_ADMIN_BOOTSTRAP_RECOVERY_CACHE\)/);
  assert.match(worker, /key\.startsWith\(IPM_CACHE_PREFIX\) && key !== IPM_SHELL_CACHE/);
  assert.match(worker, /client\.navigate\(client\.url\)/);
  assert.match(worker, /new URL\(client\.url\)\.pathname === IPM_ADMIN_LOGIN_PATH/);
});

test('updates preserve itinerary and origin storage and retain one WonderPush worker', () => {
  assert.doesNotMatch(worker + updateService, /localStorage\.clear|AsyncStorage\.clear|indexedDB\.deleteDatabase/);
  assert.doesNotMatch(worker + updateService, /serviceWorker\.unregister|getRegistrations/);
  assert.match(worker, /IPM_CACHE_PREFIX/);
  assert.match(worker, /cdn\.by\.wonderpush\.com/);
  assert.equal((rootLayout.match(/initializeOfflineShell\(\)/g) || []).length, 1);
});
