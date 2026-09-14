/* global __dirname */
// Read-only navigation tests. Local responses prevent analytics/provider writes.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium, webkit } = require(process.env.IPM_PLAYWRIGHT_MODULE || '/tmp/ipm-browser-tools/node_modules/playwright');
const origin = process.env.IPM_PREVIEW_URL || 'http://127.0.0.1:8871';
const schedule = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/map-education-schedule.json')));
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/api/vendors.json')));
const key = '@ipm_maps_tour_seen_v1';
const tip = p => p.getByTestId('map-education-card');
async function setup(browser, width, seen = false, vendor) {
 const c = await browser.newContext({ viewport: { width, height: width < 768 ? 852 : 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
 await c.route('**/*', async r => {
  const req = r.request(), url = req.url();
  if (req.method() !== 'GET') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
  if (/wonderpush|webpushr|google-analytics/.test(url)) return r.abort();
  if (url.endsWith('/api/schedule') && !process.env.IPM_LIVE_DATA) return r.fulfill({ json: schedule });
  if (vendor && url.endsWith('/api/vendors')) return r.fulfill({ json: { ...catalog, vendors: [vendor] } });
  return r.continue();
 });
 await c.addInitScript(({ key, seen }) => {
  if (seen) localStorage.setItem(key, 'true');
  window.__tourFlashes = [];
  new MutationObserver(records => {
   if (!new URLSearchParams(location.search).has('location')) return;
   for (const record of records) for (const node of record.addedNodes) {
    if (node.nodeType === 1 && (node.matches?.('[data-testid="map-education-card"]') || node.querySelector?.('[data-testid="map-education-card"]'))) window.__tourFlashes.push(node.textContent);
   }
  }).observe(document, { childList: true, subtree: true });
 }, { key, seen });
 return c;
}
async function noTour(p, highlight, seen = false) {
 await p.getByTestId(highlight).first().waitFor();
 await p.waitForTimeout(1500); // Observe multiple existing polling cycles; implementation adds no delay.
 assert.equal(await tip(p).count(), 0);
 assert.equal(await p.evaluate(k => localStorage.getItem(k), key), seen ? 'true' : null);
 assert.deepEqual(await p.evaluate(() => window.__tourFlashes), []);
 const box = await p.getByTestId(highlight).first().boundingBox();
 assert.ok(box && box.width > 0 && box.height > 0);
}
async function complete(p) {
 for (const [i, title] of ['Find parking', 'Explore Tented City', 'Find your campsite'].entries()) {
  await tip(p).getByText(title, { exact: true }).waitFor();
  await tip(p).getByText(`${i + 1} of 3`, { exact: true }).waitFor();
  await tip(p).getByRole('button', { name: i === 2 ? 'Got it' : 'Next', exact: true }).click();
 }
 assert.equal(await p.evaluate(k => localStorage.getItem(k), key), 'true');
}
(async () => {
 const engine = process.env.IPM_WEBKIT ? webkit : chromium;
 const b = await engine.launch({ args: engine === chromium ? ['--no-sandbox'] : [] });
 try {
 for (const width of [320, 360, 393, 430, 1440]) {
  // Full fresh Schedule flow, then actual normal tab navigation with a retained Maps screen.
  const c = await setup(b, width), p = await c.newPage();
  await p.goto(origin + '/schedule');
  await p.getByRole('button', { name: 'Got it, close Plan your day introduction' }).click();
  await tip(p).getByText('View event details', { exact: true }).waitFor();
  await tip(p).getByText('Tap an event to see its time, description and location.', { exact: true }).waitFor();
  await tip(p).getByRole('button', { name: 'Got it' }).click();
  const mapped = schedule.events.find(e => e.location_name === 'The Beyond Wireless Stage');
  await p.goto(origin + '/schedule?eventId=' + mapped.id);
  await p.getByTestId('schedule-find-on-map').scrollIntoViewIfNeeded();
  await tip(p).getByText('Find this event', { exact: true }).waitFor();
  await tip(p).getByRole('button', { name: 'Got it' }).click();
  await p.getByTestId('schedule-find-on-map').click();
  await noTour(p, 'selected-stage-highlight');
  if (process.env.IPM_ARTIFACT_DIR) await p.screenshot({ path: path.join(process.env.IPM_ARTIFACT_DIR, `schedule-${engine.name()}-${width}.png`) });
  await p.getByText('Home', { exact: true }).click(); await p.getByText('Map', { exact: true }).last().click();
  await complete(p);
  await c.close();
  // Fresh vendor visit and its original contextual tip. Normal entry must remain eligible.
  const vendor = catalog.vendors.find(v => v.name === 'Ontario Government');
  const vc = await setup(b, width, false, vendor), vp = await vc.newPage();
  await vp.goto(origin + '/vendors');
  await tip(vp).getByText('Find this vendor', { exact: true }).waitFor();
  await tip(vp).getByRole('button', { name: 'Got it' }).click();
  await vp.getByTestId('vendor-find-on-map').click();
  await noTour(vp, 'vendor-booth-highlight');
  if (process.env.IPM_ARTIFACT_DIR) await vp.screenshot({ path: path.join(process.env.IPM_ARTIFACT_DIR, `vendor-${engine.name()}-${width}.png`) });
  await vp.getByText('Home', { exact: true }).click(); await vp.getByText('Map', { exact: true }).last().click();
  await complete(vp); await vc.close();
  console.log(`PASS ${engine.name()} ${width}: Schedule/Vendor destinations unobscured, zero tutorial flashes, unseen flag, subsequent normal tab visit all three steps`);
 }
 // A normal first visit still auto-starts. A seen user still receives destinations without education.
 for (const seen of [false, true]) {
  const c = await setup(b, 393, seen), p = await c.newPage();
  if (!seen) { await p.goto(origin + '/'); await p.getByText('Map', { exact: true }).last().click(); await complete(p); }
  await p.goto(origin + '/map?location=The%20Beyond%20Wireless%20Stage&source=schedule&mapType=tented&showOnly=true');
  await noTour(p, 'selected-stage-highlight', true); await c.close();
 }
 // Explicit manual replay works on an unseen destination visit and doesn't alter the destination.
 const hc = await setup(b, 393), hp = await hc.newPage();
 await hp.goto(origin + '/map?location=The%20Beyond%20Wireless%20Stage&source=schedule&mapType=tented&showOnly=true');
 await noTour(hp, 'selected-stage-highlight');
 await hp.getByRole('button', { name: 'Help, replay Maps tour' }).click(); await complete(hp);
 await hp.getByTestId('selected-stage-highlight').waitFor(); await hc.close();
 console.log('PASS normal first visit, already-seen destination, deliberate Help replay with destination retained');
 } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
