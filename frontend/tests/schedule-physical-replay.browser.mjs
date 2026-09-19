// Real public Schedule data; no preview flag, fixtures, test-side scrolling or server writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.IPM_TEST_URL || 'https://staging.theipm.ca';
const out = process.env.IPM_TEST_OUTPUT || '.artifacts/physical-replay/browser';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
let page;
try {
  for (const [width, height] of [[390, 844], [390, 667], [320, 568]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
    await context.route('**/*', async route => {
      const request = route.request();
      if (!['GET', 'OPTIONS'].includes(request.method()) || /wonderpush|webpushr|google-analytics/.test(request.url())) return route.abort();
      // Local export only: relay the unchanged live response around staging's origin allowlist.
      // Published staging verification uses normal network responses without this relay.
      if (base.startsWith('http://127.0.0.1') && /onrender.com/.test(request.url())) {
        const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': request.headers()['access-control-request-headers'] || 'content-type' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        return route.fulfill({ response: await route.fetch(), headers });
      }
      return route.continue();
    });
    page = await context.newPage();
    await page.goto(base + '/schedule');
    await page.evaluate(() => {
      for (const key of ['@ipm_schedule_itinerary_onboarding_v1', '@ipm_schedule_event_details_tip_seen_v1', '@ipm_schedule_find_on_map_tip_seen_v1', '@ipm_maps_tour_seen_v1']) localStorage.setItem(key, 'true');
    });
    await page.reload();
    const tip = page.getByTestId('map-education-card');
    const help = page.getByRole('button', { name: 'Schedule Help', exact: true });
    async function noAuto() {
      await help.waitFor(); await page.waitForTimeout(1000);
      assert.equal(await tip.count(), 0);
      assert.equal(await page.getByText('Plan your day', { exact: true }).count(), 0);
    }
    async function follow(label, recovery = false) {
      await help.click();
      await page.getByText('Plan your day', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Got it, close Plan your day introduction' }).click();
      if (recovery) {
        await page.getByRole('button', { name: 'Show all events and continue walkthrough' }).waitFor();
        await page.screenshot({ path: `${out}/${width}-${height}-${label}-recovery.png` });
        await page.getByRole('button', { name: 'Show all events and continue walkthrough' }).click();
      }
      await page.getByTestId('schedule-education-open-event').waitFor();
      await tip.getByText('Tap an event', { exact: true }).waitFor();
      assert.equal(await tip.getByRole('button', { name: /Got it|Next/ }).count(), 0);
      await page.touchscreen.tap(2, 2); await page.waitForTimeout(350);
      await tip.getByText('Tap an event', { exact: true }).waitFor();
      await page.screenshot({ path: `${out}/${width}-${height}-${label}-event.png` });
      await page.getByTestId('schedule-education-open-event').tap();
      await tip.getByText('View event details', { exact: true }).waitFor();
      const action = page.getByTestId('schedule-education-open-map');
      await action.waitFor();
      const real = await page.getByTestId('schedule-find-on-map').boundingBox(), highlighted = await action.boundingBox();
      assert(real && highlighted && Math.abs(real.y - highlighted.y) < 5, 'spotlight covers the actual location action');
      await page.touchscreen.tap(2, 2); await page.waitForTimeout(350);
      await tip.getByText('View event details', { exact: true }).waitFor();
      await page.screenshot({ path: `${out}/${width}-${height}-${label}-detail.png` });
      await action.tap();
      await page.waitForURL(/\/map\?/);
      await tip.getByText('Find this event', { exact: true }).waitFor();
      const title = new URL(page.url()).searchParams.get('eventTitle');
      assert(title); assert.match(await tip.innerText(), new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await page.getByTestId('map-selection-title').waitFor();
      assert.equal(await page.getByTestId('map-selection-title').innerText(), title);
      await page.screenshot({ path: `${out}/${width}-${height}-${label}-map.png` });
      await tip.getByRole('button', { name: 'Got it', exact: true }).tap();
      assert.equal(await tip.count(), 0);
      await page.waitForFunction(() => !new URL(location.href).searchParams.has('scheduleWalkthrough'));
      return title;
    }
    await noAuto(); const title = await follow('returning-unfiltered');
    await page.goto(base + '/schedule'); await noAuto();
    await page.getByPlaceholder('Search schedule', { exact: true }).fill(title);
    await follow('filtered');
    await page.goto(base + '/schedule'); await noAuto();
    await page.getByPlaceholder('Search schedule', { exact: true }).fill('NO MATCHING EVENT 982764');
    await follow('empty-filter', true);
    if (width === 390 && height === 667) {
      await page.goto(base + '/schedule'); await noAuto();
      await page.getByText('Tuesday', { exact: true }).first().click();
      await follow('selected-day');
    }
    await page.goto(base + '/schedule'); await noAuto(); await help.click();
    await page.getByRole('button', { name: 'Skip Schedule walkthrough', exact: true }).click();
    await page.reload(); await noAuto();
    // A genuine first visit uses the same complete flow, then stays completed.
    await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('@ipm_schedule_')) localStorage.removeItem(key); });
    await page.reload(); await page.getByText('Plan your day', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Got it, close Plan your day introduction' }).click();
    await page.getByTestId('schedule-education-open-event').waitFor();
    await page.getByRole('button', { name: 'Skip walkthrough', exact: true }).click();
    await page.reload(); await noAuto();
    console.log(`PASS ${width}x${height}: completed returning attendee manual replay; unfiltered/filtered/empty recovery; event/detail/map guidance; unrelated taps blocked; first visit and skip persistence`);
    await context.close();
  }
} catch (error) {
  if (page) { await page.screenshot({ path: out + '/failure.png' }); console.error((await page.locator('body').innerText()).slice(-3000)); }
  throw error;
} finally { await browser.close(); }
