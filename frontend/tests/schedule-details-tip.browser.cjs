/* global __dirname */
// Exercise the real UI; block external writes and push providers throughout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('/tmp/ipm-browser-tools/node_modules/playwright');
const origin = process.env.IPM_PREVIEW_URL || 'http://127.0.0.1:8870';
const schedule = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/map-education-schedule.json')));
const keys = ['@ipm_schedule_itinerary_onboarding_v1', '@ipm_schedule_event_details_tip_seen_v1', '@ipm_schedule_find_on_map_tip_seen_v1', '@ipm_maps_tour_seen_v1', '@ipm_vendor_find_on_map_tip_seen_v1'];
const artifact = process.env.IPM_ARTIFACT_DIR || '/tmp';
(async () => {
 for (const engine of process.env.IPM_WEBKIT ? [webkit] : [chromium]) {
 const browser = await engine.launch({ args: engine === chromium ? ['--no-sandbox'] : [] });
 try {
 for (const width of [320, 360, 393, 430, 1440]) {
  const height = width === 1440 ? 1000 : Number(process.env.IPM_PHONE_HEIGHT || 852);
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.route('**/*', async route => {
   const req = route.request();
   if (req.method() !== 'GET') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
   if (/wonderpush|webpushr|google-analytics/.test(req.url())) return route.abort();
   if (req.url().endsWith('/api/schedule') && !process.env.IPM_LIVE_DATA) return route.fulfill({ json: schedule });
   if (req.url().includes('ipm-staging-backend.onrender.com') && origin !== 'https://staging.theipm.ca') {
    const response = await route.fetch(); return route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
   }
   return route.continue();
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => {
   // WebKit can report the intentionally intercepted analytics beacon as a CORS error.
   if (!/api\/activity\/events due to access control checks/.test(e.message)) errors.push(e.message);
  });
  await page.goto(origin + '/schedule');
  const tip = page.getByTestId('map-education-card');
  await page.getByText('Plan your day', { exact: true }).waitFor();
  await page.waitForTimeout(900); assert.equal(await tip.count(), 0);
  await page.getByRole('button', { name: 'Got it, close Plan your day introduction' }).click();
  await tip.getByText('View event details', { exact: true }).waitFor();
  await tip.getByText('Tap an event to see its time, description and location.', { exact: true }).waitFor();
  await page.waitForTimeout(400);
  const spotlight = await page.getByTestId('map-education-spotlight').boundingBox(), box = await tip.boundingBox();
  assert.ok(spotlight && spotlight.height > 80 && spotlight.y >= 0);
  assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height);
  assert.ok(box.y >= spotlight.y + spotlight.height - 4 || box.y + box.height <= spotlight.y + 4, 'Callout does not cover event card');
  await page.screenshot({ path: path.join(artifact, `details-${engine.name()}-${width}-${height}.png`) });
  await page.keyboard.press('Tab'); assert.equal(await tip.getByRole('button', { name: 'Got it' }).evaluate(e => e === document.activeElement), true);
  if (width === 360) { await page.keyboard.press('Escape'); await tip.waitFor({ state: 'hidden' }); }
  else { await page.getByTestId('schedule-education-open-event').click(); }
  assert.deepEqual(await page.evaluate(ks => ks.map(k => localStorage.getItem(k)), keys), ['true', 'true', null, null, null]);
  const mapped = schedule.events.find(e => e.location_name === 'The Beyond Wireless Stage');
  await page.goto(origin + '/schedule?eventId=' + mapped.id);
  await page.getByTestId('schedule-find-on-map').scrollIntoViewIfNeeded();
  await tip.getByText('Find this event', { exact: true }).waitFor();
  await tip.getByText('Tap here to see exactly where this event is on the map.', { exact: true }).waitFor();
  await tip.getByRole('button', { name: 'Got it' }).click();
  await page.getByTestId('schedule-find-on-map').click();
  await page.getByTestId('selected-stage-highlight').waitFor();
  await page.waitForTimeout(1000); assert.equal(await tip.count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('@ipm_maps_tour_seen_v1')), null);
  await page.getByText('Home', { exact: true }).click();
  await page.getByText('Map', { exact: true }).last().click();
  await tip.getByText('Find parking', { exact: true }).waitFor();
  await tip.getByRole('button', { name: 'Skip Maps tour' }).click();
  await page.goto(origin + '/schedule'); await page.getByPlaceholder('Search schedule').waitFor();
  await page.waitForTimeout(1300); assert.equal(await tip.count(), 0); assert.equal(await page.getByText('Plan your day', { exact: true }).count(), 0);
  await page.goto(origin + '/schedule?eventId=' + mapped.id); await page.getByTestId('schedule-find-on-map').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000); assert.equal(await tip.count(), 0);
  assert.equal(await page.evaluate(k => localStorage.getItem(k), keys[4]), null);
  assert.deepEqual(errors, []);
  console.log(`PASS ${engine.name()} ${width}: fresh sequence, visible card, copy, touch/Escape/focus, mapped action, returning persistence, independence`);
  await context.unrouteAll({ behavior: 'wait' }); await context.close();
 }
 } finally { await browser.close(); }
 }
})().catch(e => { console.error(e); process.exitCode = 1; });
