/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.IPM_PLAYWRIGHT_MODULE || '/tmp/ipm-browser-tools/node_modules/playwright');
const origin = process.env.IPM_PREVIEW_URL || 'http://127.0.0.1:8871';
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/api/vendors.json')));
(async () => {
 const b = await chromium.launch({ args: ['--no-sandbox'] });
 try {
 for (const [name, seen] of [['Bambrook Farm Equipment', false], ['Transit Trailer Ltd', false], ['Ontario Government', true]]) {
  const c = await b.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block' });
  await c.route('**/*', r => {
   if (r.request().method() !== 'GET' || /wonderpush|webpushr|google-analytics/.test(r.request().url())) return r.abort();
   if (r.request().url().endsWith('/api/vendors')) return r.fulfill({ json: { ...catalog, vendors: catalog.vendors.filter(v => v.name === name) } });
   return r.continue();
  });
  if (seen) await c.addInitScript(() => localStorage.setItem('@ipm_maps_tour_seen_v1', 'true'));
  const p = await c.newPage(); await p.goto(origin + '/vendors');
  await p.getByTestId('vendor-find-on-map').scrollIntoViewIfNeeded();
  const tip = p.getByTestId('map-education-card');
  await tip.getByText('Find this vendor', { exact: true }).waitFor(); await tip.getByRole('button', { name: 'Got it' }).click();
  await p.getByTestId('vendor-find-on-map').click(); await p.locator('[data-testid=vendor-booth-highlight], [data-testid=selected-booth-highlight]').first().waitFor();
  await p.waitForTimeout(1100); assert.equal(await tip.count(), 0);
  assert.equal(await p.evaluate(() => localStorage.getItem('@ipm_maps_tour_seen_v1')), seen ? 'true' : null);
  await p.getByRole('button', { name: 'Help, replay Maps tour' }).click(); await tip.getByText('Find parking', { exact: true }).waitFor();
  await tip.getByRole('button', { name: 'Skip Maps tour' }).click(); await p.locator('[data-testid=vendor-booth-highlight], [data-testid=selected-booth-highlight]').first().waitFor();
  console.log(`PASS ${name}: unchanged booth highlight, seen=${seen}, Vendor education, Maps deferral and manual Help`); await c.close();
 }
 const c = await b.newContext({ serviceWorkers: 'block' });
 await c.route('**/*', r => r.request().method() !== 'GET' || /wonderpush|webpushr|google-analytics/.test(r.request().url()) ? r.abort() : r.continue());
 const p = await c.newPage();
 await p.goto(origin + '/map?location=Quilt%20Tent&source=vendors&mapType=tented&showOnly=true');
 await p.getByTestId('selected-parent-range-fill').first().waitFor(); await p.waitForTimeout(1100);
 assert.equal(await p.getByTestId('map-education-card').count(), 0);
 assert.equal(await p.evaluate(() => localStorage.getItem('@ipm_maps_tour_seen_v1')), null);
 console.log('PASS parent-range fallback retained without automatic tutorial'); await c.close();
 } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
