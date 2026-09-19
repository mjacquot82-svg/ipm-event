const assert = require('node:assert/strict');
const { chromium } = require(process.env.IPM_PLAYWRIGHT_MODULE || '/tmp/ipm-browser-tools/node_modules/playwright');
const origin = process.env.IPM_PREVIEW_URL || 'http://127.0.0.1:8871';
assert.ok(origin.startsWith('http://127.0.0.1:'));
(async () => {
 const b = await chromium.launch({ args: ['--no-sandbox'] });
 try {
 const c = await b.newContext({ viewport: { width: 393, height: 852 } });
 await c.addInitScript(() => {
  const original = window.matchMedia.bind(window);
  window.matchMedia = q => q === '(display-mode: standalone)' ? { ...original(q), matches: true, addEventListener() {}, removeEventListener() {} } : original(q);
 });
 await c.route('**/*', r => r.request().method() !== 'GET' || (!r.request().url().startsWith(origin) && /wonderpush|webpushr|google-analytics|onrender/.test(r.request().url())) ? r.abort() : r.continue());
 const p = await c.newPage();
 await p.goto(origin + '/map?location=The%20Beyond%20Wireless%20Stage&source=schedule&mapType=tented&showOnly=true');
 await p.getByTestId('selected-stage-highlight').waitFor();
 await p.evaluate(async () => { await navigator.serviceWorker.register('/webpushr-sw.js'); await navigator.serviceWorker.ready; });
 await p.waitForFunction(async () => { const d = await (await fetch('/app-release.json')).json(); return !!await caches.match(d.entry) && !!await caches.match('/index.html'); });
 await c.setOffline(true); await p.reload();
 await p.getByTestId('selected-stage-highlight').waitFor(); await p.waitForTimeout(1200);
 assert.equal(await p.getByTestId('map-education-card').count(), 0);
 assert.equal(await p.evaluate(() => localStorage.getItem('@ipm_maps_tour_seen_v1')), null);
 await p.getByText('Home', { exact: true }).click(); await p.getByText('Map', { exact: true }).last().click();
 const tip = p.getByTestId('map-education-card'); await tip.getByText('Find parking', { exact: true }).waitFor();
 await tip.getByRole('button', { name: 'Skip Maps tour' }).click();
 assert.equal(await p.evaluate(() => localStorage.getItem('@ipm_maps_tour_seen_v1')), 'true');
 await p.reload(); await p.getByRole('button', { name: 'Map Help, replay Maps tour' }).waitFor(); await p.waitForTimeout(1000);
 assert.equal(await tip.count(), 0);
 console.log('PASS installed-mode offline cached destination, deferred flag unchanged, later normal Maps tour, local skip persistence and offline reload');
 } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
