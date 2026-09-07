import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = 'https://staging.theipm.ca';
const sourceFiles = {
  '/api/pixel-diagnostic.html': ['index.html', 'text/html'],
  '/api/pixel-diagnostic.mjs': ['diagnostic.mjs', 'text/javascript'],
  '/api/pixel-diagnostic-page.mjs': ['page.mjs', 'text/javascript'],
};
test('isolated browser page: no app or SDK requests, one GET, safe rendered output', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const requests = [];
    await context.route('**/*', async (route) => {
      const req = route.request(); requests.push({ url: req.url(), method: req.method() });
      const url = new URL(req.url());
      const file = sourceFiles[url.pathname];
      if (url.origin === origin && file) return route.fulfill({ contentType: file[1], body: readFileSync(new URL(file[0], import.meta.url)) });
      if (url.origin === 'https://ipm-staging-backend.onrender.com' && url.pathname.endsWith('/status-by-capability')) {
        return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': origin }, body: JSON.stringify({
          provider_checked_at: '2026-09-04T12:52:53Z', provider_has_push_token: true,
          provider_deliverable: true, provider_reachability: 'optIn', registration_fingerprint: 'DO_NOT_EXPOSE',
        }) });
      }
      throw new Error('Unexpected request');
    });
    await context.addInitScript(() => {
      localStorage.setItem('@ipm_notification_capability_v1', 'a'.repeat(43));
      Object.defineProperty(navigator, 'serviceWorker', { value: {
        controller: {}, getRegistration: async () => ({ scope: 'https://staging.theipm.ca/',
          active: { scriptURL: 'https://staging.theipm.ca/webpushr-sw.js?webKey=DO_NOT_EXPOSE' },
          pushManager: { getSubscription: async () => ({ endpoint: 'DO_NOT_EXPOSE' }) },
        }),
      } });
    });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', (error) => errors.push(error.name));
    await page.goto(`${origin}/api/pixel-diagnostic.html`);
    assert.equal(requests.length, 3);
    await page.getByRole('button', { name: 'Read current state once' }).click();
    await page.waitForFunction(() => document.getElementById('result').textContent.includes('READ_STORED_ONLY'));
    const output = await page.locator('#result').textContent();
    assert.equal(output.includes('DO_NOT_EXPOSE'), false);
    assert.equal(output.includes('a'.repeat(43)), false);
    assert.equal(JSON.parse(output).browser_push_subscription_present, true);
    assert.equal(JSON.parse(output).wonderpush_local_subscribed, 'UNKNOWN');
    assert.equal(await page.locator('#inspect').isDisabled(), true);
    assert.deepEqual(errors, []);
    assert.equal(requests.length, 4);
    assert.ok(requests.every((request) => request.method === 'GET'));
    await context.close();
  } finally { await browser.close(); }
});
