// Local built-app fixtures only. Every API read is mocked; writes/external traffic are blocked.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ANALYTICS_UI_URL || 'http://localhost:8096';
const days = Array.from({ length: 264 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), sessions: i % 10, visitors: 1, launches: 1, pageViews: 1 }));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [], mutations = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.pathname.startsWith('/api/')) {
    if (request.method() !== 'GET') { mutations.push(url.pathname); return route.abort(); }
    let body = {};
    const range = url.searchParams.get('range') || '7d';
    if (url.pathname.endsWith('/auth/me')) body = { user: { id: 'fixture', username: 'fixture', display_name: 'LOCAL FIXTURE', role: 'Owner', event_id: 'ipm-2026', is_active: true } };
    else if (url.pathname.endsWith('/analytics/summary')) body = { overview: { uniqueVisitors: 1, newVisitors: 1, returningVisitors: 0, sessions: 1, launches: 1, pageViews: 1, installedPwaVisitors: 0, browserOnlyVisitors: 1, averageSessionDurationSeconds: null, sessionDurationSampleSize: 0 } };
    else if (url.pathname.endsWith('/analytics/traffic')) body = { range, traffic: { todayByHour: [{ hour: '10', sessions: 2 }], byDay: range === 'all' ? days : days.slice(range === '30d' ? -30 : -7) } };
    else if (url.pathname.endsWith('/analytics/live')) body = { live: { activeSessions: 0, activityLastMinute: 0, activityLastFiveMinutes: 0, mostRecentActivityAt: null, activityWindowMinutes: 30, topActivePages: [] } };
    else if (url.pathname.endsWith('/analytics/content')) body = { content: { pages: [], vendors: { filters: [] }, map: { sources: [], locations: [] }, schedule: { filters: [], mostOpenedEvents: [] }, announcements: { openSources: [], ranking: [] }, queenOfTheFurrow: {}, quickActions: { actions: [], destinationTypes: [], sources: [] }, outboundLinks: { destinations: [], destinationTypes: [] }, featureAdoption: [], eventDayComparisons: [] } };
    else if (url.pathname.endsWith('/notification-summary')) body = { accepted_sends: 0, failed_requests: 0, pending_requests: 0, recent: [] };
    else if (url.pathname.endsWith('/popular-events')) body = { items: [] };
    else if (url.pathname.endsWith('/analytics/reminders')) body = { active_interests: 0, provider_accepted: 0, provider_failed: 0, delivery_unknown: 0 };
    else body = { announcements: [], deliveries: [], vendors: [], events: [], total_count: 0 };
    return route.fulfill({ json: body });
  }
  if (url.origin === new URL(base).origin) return route.continue();
  return route.abort();
});
const selector = '[aria-label="Daily traffic chart, scroll to view all dates"]';
async function atEnd() {
  await page.waitForFunction(selector => {
    const element = document.querySelector(selector);
    return element && element.scrollWidth > element.clientWidth && Math.abs(element.scrollLeft + element.clientWidth - element.scrollWidth) < 3;
  }, selector);
}
try {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/admin/', { waitUntil: 'domcontentloaded' });
    await page.getByText('Analytics', { exact: true }).first().click();
    await page.setViewportSize({ width, height: 1000 });
    for (const [label, count] of [['7 Days', 7], ['30 Days', 30], ['All Time', 264]]) {
      await page.getByText(label, { exact: true }).click();
      await page.waitForFunction(count => document.querySelectorAll('[aria-label^="2026-"][aria-label$=" sessions"]').length === count, count);
      const dates = await page.locator('[aria-label^="2026-"][aria-label$=" sessions"]').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label').slice(0, 10)));
      assert.deepEqual(dates, days.slice(-count).map(day => day.date));
    }
    await atEnd();
    const chart = page.locator(selector);
    assert.equal(await chart.evaluate(element => getComputedStyle(element).scrollbarWidth), 'auto');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await chart.hover(); await page.mouse.wheel(-500, 0);
    await page.waitForFunction(selector => { const e = document.querySelector(selector); return e.scrollLeft + e.clientWidth < e.scrollWidth - 100; }, selector);
    await page.getByRole('button', { name: 'Show earliest traffic dates' }).click();
    await page.waitForFunction(selector => document.querySelector(selector).scrollLeft < 2, selector);
    // Resize/layout must not override the user's chosen earlier history.
    await page.setViewportSize({ width, height: 950 });
    assert.ok(await chart.evaluate(element => element.scrollLeft < 2));
    await page.getByRole('button', { name: 'Show latest traffic dates' }).focus();
    await page.keyboard.press('Enter');
    await atEnd();
    console.log(`PASS ${width}px: all 264 days, chronological order, newest start, scrollbar, wheel, earliest/latest keyboard controls, no page overflow`);
  }
  assert.deepEqual(errors, []); assert.deepEqual(mutations, []);
} finally { await browser.close(); }
