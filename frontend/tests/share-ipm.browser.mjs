// Browser APIs are controlled; no messages, provider requests or analytics writes leave this test.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.IPM_TEST_URL || 'http://localhost:8100';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox'] });
const payload = { title: 'International Plowing Match 2026', text: 'Get schedules, maps, announcements and event information in the official IPM app.', url: 'https://theipm.ca' };
for (const [mode, width, offline] of [
  ['native', 320, false], ['native', 390, true], ['native', 1440, false],
  ['cancel', 390, false], ['failure', 390, false], ['copy', 320, false],
  ['copy', 1440, true], ['manual', 320, false], ['clipboard-error', 390, true],
]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  await context.addInitScript(({ mode }) => {
    window.__shares = []; window.__copies = []; window.__permissionRequests = 0; window.__installPrompts = 0;
    localStorage.setItem('@event_navigator_favorites', JSON.stringify({ sessionIds: ['share-safety-canary'] }));
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'denied', requestPermission: async () => { window.__permissionRequests++; return 'denied'; } } });
    const reg = { update: async () => {}, pushManager: { getSubscription: async () => null } };
    if (navigator.serviceWorker) { navigator.serviceWorker.register = async () => reg; navigator.serviceWorker.getRegistration = async () => reg; }
    window.WonderPush = { push() {}, isSubscribedToNotifications: async () => false };
    Object.defineProperty(navigator, 'share', { configurable: true, value: ['native', 'cancel', 'failure'].includes(mode) ? async data => {
      window.__shares.push({ data, active: navigator.userActivation.isActive });
      if (mode === 'cancel') throw new DOMException('cancelled', 'AbortError');
      if (mode === 'failure') throw new Error('private error should never be displayed');
    } : undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: mode === 'manual' ? undefined : { writeText: async text => {
      if (mode === 'clipboard-error') throw new Error('clipboard denied');
      window.__copies.push(text);
    } } });
    window.addEventListener('beforeinstallprompt', e => { Object.defineProperty(e, 'prompt', { value: () => { window.__installPrompts++; } }); });
  }, { mode });
  const analytics = [], unexpectedWrites = [];
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith('/api/activity/')) {
      if (url.pathname === '/api/activity/events') analytics.push(...(request.postDataJSON()?.events || []));
      return route.fulfill({ json: { ok: true, accepted: true } });
    }
    if (request.method() !== 'GET') { unexpectedWrites.push(url.pathname); return route.abort(); }
    if (url.hostname === 'cdn.by.wonderpush.com') return route.fulfill({ contentType: 'application/javascript', body: '/* inert provider fixture */' });
    if (url.pathname === '/api/schedule') return route.fulfill({ json: { events: [], last_updated: '2026-09-09T00:00:00Z' } });
    if (url.pathname === '/api/announcements') return route.fulfill({ json: { announcements: [] } });
    if (url.origin === new URL(base).origin && !url.pathname.startsWith('/api/')) return route.continue();
    return route.abort();
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/?private-route-canary=do-not-share', { waitUntil: 'domcontentloaded' });
  const countdown = page.getByText('IPM 2026 Starts In', { exact: true });
  await countdown.waitFor(); await page.waitForTimeout(500);
  const countdownY = (await countdown.boundingBox()).y;
  assert(countdownY < (width < 720 ? 500 : 800));
  const button = page.getByRole('button', { name: 'Share IPM', exact: true });
  await button.scrollIntoViewIfNeeded();
  const box = await button.boundingBox();
  assert(box.width < width / 2 && box.height < 150, 'compact existing Quick Action');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const favoritesBefore = await page.evaluate(() => localStorage.getItem('@event_navigator_favorites'));
  if (offline) await context.setOffline(true);
  // Focus and Enter exercise the real accessible button and preserve user activation.
  await button.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  const state = await page.evaluate(() => ({ shares: window.__shares, copies: window.__copies, permissions: window.__permissionRequests, installs: window.__installPrompts, favorites: localStorage.getItem('@event_navigator_favorites') }));
  assert.equal(state.permissions, 0); assert.equal(state.installs, 0); assert.equal(state.favorites, favoritesBefore);
  if (['native', 'cancel', 'failure'].includes(mode)) {
    assert.equal(state.shares.length, 1); assert.deepEqual(state.shares[0].data, payload); assert.equal(state.shares[0].active, true);
  } else assert.equal(state.shares.length, 0);
  if (['copy', 'failure'].includes(mode)) {
    assert.deepEqual(state.copies, ['https://theipm.ca']); await page.getByText('IPM link copied', { exact: true }).waitFor();
  } else assert.deepEqual(state.copies, []);
  if (['manual', 'clipboard-error'].includes(mode)) {
    await page.getByText('Copy this link to share IPM:', { exact: true }).waitFor();
    const link = page.getByText('https://theipm.ca', { exact: true }); await link.waitFor();
    assert.equal(await link.evaluate(el => getComputedStyle(el).userSelect), 'text');
  }
  const text = await page.locator('body').innerText();
  assert(!/share completed|successfully shared|private error|Use IPM now|Notification delivery is not verified/i.test(text));
  if (mode === 'cancel' || mode === 'native') assert(!/IPM link copied|Copy this link/.test(text));
  await page.waitForTimeout(2300);
  const selected = analytics.filter(e => e.eventName === 'home_quick_action_clicked' && e.properties.action_id === 'share_ipm');
  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0].properties, { action_id: 'share_ipm', destination_type: 'share', source: 'home' });
  assert(!analytics.some(e => /share_completed|share_success/.test(e.eventName)));
  assert.deepEqual(errors, []); assert.deepEqual(unexpectedWrites, []);
  if (process.env.IPM_SCREENSHOTS) await page.screenshot({ path: `${process.env.IPM_SCREENSHOTS}/share-${mode}-${width}-${offline}.png` });
  console.log('PASS', mode, width, offline ? 'offline' : 'online', 'canonical payload; keyboard; aggregate selection only; no side effects; countdown y', Math.round(countdownY));
  await context.close();
}
await browser.close();
