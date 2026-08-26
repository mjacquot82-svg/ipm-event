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
  assert.match(html, /We're opening saved event information so you can keep using the app/);
  assert.match(html, /role="status" aria-live="polite"/);
});

test('React owns the root after loading, so the pre-React reassurance disappears naturally', async () => {
  const [html, layout] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /<div id="root">[\s\S]*ipm-startup-splash/);
  assert.match(layout, /isInitializing \? \([\s\S]*<SplashScreen/);
  assert.doesNotMatch(layout, /setTimeout[\s\S]*setIsInitializing\(false\)/);
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
  assert.doesNotMatch(worker, /skipWaiting/);
  assert.doesNotMatch(worker, /addEventListener\(['"](?:push|notificationclick)['"]/);
});
