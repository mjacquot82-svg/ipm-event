/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('/tmp/ipm-browser-tools/node_modules/playwright');
const origin = 'http://127.0.0.1:8870';
const schedule = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/map-education-schedule.json')));
(async () => {
 const b = await chromium.launch({ args: ['--no-sandbox'] });
 try {
 const c = await b.newContext({ viewport: { width: 393, height: 852 } });
 await c.route('**/*', r => {
  if (r.request().method() !== 'GET' || (!r.request().url().startsWith(origin) && /wonderpush|webpushr|google-analytics/.test(r.request().url()))) return r.abort();
  if (r.request().url().endsWith('/api/schedule')) return r.fulfill({ json: schedule });
  return r.continue();
 });
 const p = await c.newPage(); await p.goto(origin + '/about');
 const oldKeys = ['@ipm_schedule_itinerary_onboarding_v1', '@ipm_schedule_find_on_map_tip_seen_v1', '@ipm_maps_tour_seen_v1', '@ipm_vendor_find_on_map_tip_seen_v1', 'unrelated-onboarding-test'];
 await p.evaluate(ks => ks.forEach(k => localStorage.setItem(k, 'true')), oldKeys);
 await p.goto(origin + '/schedule');
 const tip = p.getByTestId('map-education-card'); await tip.getByText('View event details', { exact: true }).waitFor();
 assert.equal(await p.getByText('Plan your day', { exact: true }).count(), 0);
 await p.evaluate(async () => { await navigator.serviceWorker.register('/webpushr-sw.js'); await navigator.serviceWorker.ready; });
 await p.waitForFunction(async () => { const d = await (await fetch('/app-release.json')).json(); return !!await caches.match(d.entry) && !!await caches.match('/index.html'); });
 await c.setOffline(true);
 await tip.getByRole('button', { name: 'Got it' }).click();
 await p.reload(); await p.getByPlaceholder('Search schedule').waitFor(); await p.waitForTimeout(1500);
 assert.equal(await tip.count(), 0); assert.equal(await p.getByText('Plan your day', { exact: true }).count(), 0);
 assert.equal(await p.evaluate(() => localStorage.getItem('@ipm_schedule_event_details_tip_seen_v1')), 'true');
 assert.deepEqual(await p.evaluate(ks => ks.map(k => localStorage.getItem(k)), oldKeys), oldKeys.map(() => 'true'));
 console.log('PASS existing-user migration, Got it saved offline, offline Schedule reload, no repeated tips, all existing flags unchanged');
 } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
