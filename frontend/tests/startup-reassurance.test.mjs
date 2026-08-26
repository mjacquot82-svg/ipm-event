import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function getInlineStartupScript() {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const match = html.match(/<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/);
  assert.ok(match, 'startup reassurance script should be embedded in the cached HTML shell');
  return { html, script: match[1] };
}

function runStartupScript(script, online) {
  const timers = [];
  const reassurance = { hidden: true, isConnected: true };
  vm.runInNewContext(script, {
    document: { getElementById: () => reassurance },
    navigator: { onLine: online },
    performance: { now: () => 10 },
    window: { setTimeout: (callback, delay) => { timers.push({ callback, delay }); } },
  });
  return { reassurance, timers };
}

test('fast online startup does not flash the slow-start reassurance', async () => {
  const { script } = await getInlineStartupScript();
  const result = runStartupScript(script, true);
  assert.equal(result.reassurance.hidden, true);
  assert.equal(result.timers.length, 1);
  assert.equal(result.timers[0].delay, 2500);
});

test('slow startup reveals reassurance after the threshold without blocking readiness', async () => {
  const { script } = await getInlineStartupScript();
  const result = runStartupScript(script, true);
  result.timers[0].callback();
  assert.equal(result.reassurance.hidden, false);
  assert.equal(result.timers[0].delay, 2500);
});

test('cold offline HTML shell reveals reassurance before React is ready', async () => {
  const { html, script } = await getInlineStartupScript();
  const result = runStartupScript(script, false);
  assert.equal(result.reassurance.hidden, false);
  assert.equal(result.timers.length, 0);
  assert.match(html, /Limited connection — IPM is still loading/);
  assert.match(html, /We're opening saved information so you can keep using the app/);
  assert.match(html, /role="status" aria-live="polite"/);
});

test('startup reassurance uses prominent, readable mobile typography in both startup layers', async () => {
  const [html, splash] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/SplashScreen.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /font-size: clamp\(24px, 6\.5vw, 28px\)/);
  assert.match(html, /font-size: clamp\(18px, 4\.8vw, 20px\)/);
  assert.match(html, /font-weight: 800/);
  assert.match(html, /width: calc\(100% - 16px\)/);
  assert.match(html, /padding: 20px 22px/);
  assert.match(html, /border: 2px solid #4E725A/);
  assert.match(splash, /reassuranceTitle:[\s\S]*fontSize: 22[\s\S]*fontWeight: '800'/);
  assert.match(splash, /reassuranceMessage:[\s\S]*fontSize: 17[\s\S]*lineHeight: 25/);
  assert.match(splash, /We&apos;re opening saved information so you can keep using the app/);
});

test('React owns the root after loading, so the pre-React reassurance disappears naturally', async () => {
  const [html, layout] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /<div id="root">[\s\S]*ipm-startup-splash/);
  assert.match(layout, /isInitializing \? \([\s\S]*<SplashScreen/);
  assert.match(layout, /useState\(Platform\.OS !== 'web'\)/);
  assert.doesNotMatch(layout, /setTimeout[\s\S]*setIsInitializing\(false\)/);
});

test('Android manifest splash is OS-owned and reassurance begins in the earliest controllable HTML', async () => {
  const [appConfig, html] = await Promise.all([
    readFile(new URL('../app.json', import.meta.url), 'utf8'),
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  ]);
  const config = JSON.parse(appConfig);
  assert.equal(config.expo.splash.image, './assets/images/ipm-logo.png');
  assert.equal('message' in config.expo.splash, false);
  assert.match(html, /ipm-startup-reassurance/);
});

test('staging offline diagnostic is safe, works from cached browser state, and applies once', async () => {
  const [service, card] = await Promise.all([
    readFile(new URL('../src/services/offlineShellStatus.web.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/StagingOfflineStatus.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(service, /cachedShellVersions/);
  assert.match(service, /controllingShellVersion/);
  assert.match(service, /bundleIdentity/);
  assert.match(service, /registration\?\.waiting/);
  assert.match(service, /IPM_ACTIVATE_WAITING_UPDATE/);
  assert.match(service, /controllerchange/);
  assert.match(service, /\{ once: true \}/);
  assert.doesNotMatch(service + card, /installationId|webKey|permission|subscribeToNotifications/);
  assert.match(card, /EXPO_PUBLIC_BACKEND_URL\?\.includes\('staging'\)/);
});

test('normal Home hero overlay is selected for shell precache with field fallback retained', async () => {
  const [banner, generator] = await Promise.all([
    readFile(new URL('../src/components/ResponsiveBanner.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/generate-offline-worker.js', import.meta.url), 'utf8'),
  ]);
  assert.match(banner, /field\.png/);
  assert.match(banner, /gemini4\.png/);
  assert.match(generator, /field\|gemini4/);
});

test('refreshed shell retains new saved-data wording and safe worker update lifecycle', async () => {
  const [banner, worker] = await Promise.all([
    readFile(new URL('../src/components/CachedDataBanner.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8'),
  ]);
  assert.match(banner, /Limited internet connection/);
  assert.match(banner, /saved \$\{informationLabel\}/);
  assert.match(worker, /cache\.addAll\(IPM_SHELL_ASSETS\)/);
  assert.match(worker, /addEventListener\('activate'/);
  assert.match(worker, /IPM_ACTIVATE_WAITING_UPDATE[\s\S]*skipWaiting/);
  const installHandler = worker.match(/addEventListener\('install'[\s\S]*?\n\}\);/)?.[0] || '';
  assert.doesNotMatch(installHandler, /skipWaiting/);
  assert.doesNotMatch(worker, /addEventListener\(['"](?:push|notificationclick)['"]/);
});
