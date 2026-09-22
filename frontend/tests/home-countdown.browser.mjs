// Verify only a local exported build with the clock controlled around event start.
// API requests are mocked and all non-app traffic is blocked: no analytics/provider writes.
import assert from 'node:assert/strict';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dist = path.resolve(process.env.IPM_TEST_DIST || 'dist');
const output = process.env.IPM_TEST_OUTPUT || '.artifacts/home-countdown';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const welcome = 'The countdown is over! Welcome to the 2026 International Plowing Match & Rural Expo!';
const results = [];
try {
  const cases = [320, 390, 768, 1440].flatMap(width => [
    { width, host: 'localhost', state: 'before', time: '2026-09-22T12:59:59.999Z', welcome: false },
    { width, host: 'localhost', state: 'at', time: '2026-09-22T13:00:00.000Z', welcome: true },
    { width, host: 'localhost', state: 'after', time: '2026-09-22T13:00:00.001Z', welcome: true },
  ]);
  for (const scenario of cases) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: 900 }, timezoneId: 'America/Toronto', serviceWorkers: 'block' });
    await context.addInitScript(() => {
      localStorage.setItem('pwa_install_entry_completed', 'true');
      sessionStorage.setItem('pwa_install_session_dismissed', 'true');
    });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) {
        return route.fulfill({ json: { events: [], announcements: [], vendors: [], content_revision: 1 } });
      }
      if (route.request().method() !== 'GET' || url.hostname !== scenario.host) return route.abort();
      let file = path.join(dist, decodeURIComponent(url.pathname));
      if (!file.startsWith(dist + path.sep)) return route.abort();
      try { if (!(await stat(file)).isFile()) file = path.join(dist, 'index.html'); }
      catch { file = path.join(dist, 'index.html'); }
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
      return route.fulfill({ path: file, contentType: types[path.extname(file)] || 'application/octet-stream' });
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date(scenario.time));
    await page.goto(`http://${scenario.host}/`);
    const target = page.getByText(scenario.welcome ? welcome : 'IPM 2026 Starts In', { exact: true });
    await target.waitFor();
    await target.scrollIntoViewIfNeeded();
    assert.equal(await page.getByTestId('countdown-clock').count(), scenario.welcome ? 0 : 1);
    if (scenario.welcome) {
      const card = await page.getByTestId('home-countdown-card').boundingBox();
      const text = await target.boundingBox();
      assert.ok(Math.abs((card.x + card.width / 2) - (text.x + text.width / 2)) < 1, 'Welcome is centered across the full card');
    }
    assert.equal(await page.getByText(scenario.welcome ? 'IPM 2026 Starts In' : welcome, { exact: true }).count(), 0);
    for (const label of ['Quick Actions', 'Emergency Services', 'Accessibility Information']) assert.ok(await page.getByText(label, { exact: true }).count(), label);
    const bounds = await target.evaluate(el => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, height: r.height, pageWidth: document.documentElement.scrollWidth, viewport: innerWidth, textWidth: el.scrollWidth, boxWidth: el.clientWidth };
    });
    assert.ok(bounds.pageWidth <= scenario.width, JSON.stringify(bounds));
    assert.ok(bounds.left >= 0 && bounds.right <= scenario.width, JSON.stringify(bounds));
    assert.ok(bounds.textWidth <= bounds.boxWidth, JSON.stringify(bounds));
    const name = `${scenario.host}-${scenario.width}-${scenario.state}`;
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    results.push({ name, ...bounds, passed: true });
    if (!scenario.welcome) {
      await page.clock.setFixedTime(new Date('2026-09-22T13:00:00Z'));
      await page.getByText(welcome, { exact: true }).waitFor();
      assert.equal(await page.getByText('IPM 2026 Starts In', { exact: true }).count(), 0);
      assert.equal(await page.getByTestId('countdown-clock').count(), 0);
    }
    await context.close();
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
