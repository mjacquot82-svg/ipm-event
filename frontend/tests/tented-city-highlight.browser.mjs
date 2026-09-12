// Run against a built app: IPM_TEST_URL=... PLAYWRIGHT_MODULE=... node tests/tented-city-highlight.browser.mjs
// All writes and notification providers are blocked; schedule is a read-only snapshot.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.IPM_TEST_URL || 'http://localhost:8098';
const output = process.env.IPM_TEST_OUTPUT || '/tmp/ipm-booth-center';
fs.mkdirSync(output, { recursive: true });
const schedule = JSON.parse(fs.readFileSync(process.env.IPM_SCHEDULE_SNAPSHOT));
assert.equal(schedule.events.length, 218);
const cases = [
  ['ACE / JCB, Harriston', '1A-09'],
  ['GGS Structures Inc., Vineland Station', '2B-23'],
  ['Kodiak Boots, Cambridge', '2B-06'],
  ['Hip Town Hype, Trent Lakes', '4A-14'],
  ['StumpedIt', '5A-33'],
  ['Harkness Equipment, Harriston', '1B-15'],
];
// Use the exact bundled names for the vendor deep links.
const dataDir = new URL('../src/data/', import.meta.url);
const vendors = fs.readdirSync(dataDir).filter(f => /^tentedCityVendorsPart\d+\.ts$/.test(f)).flatMap(f => {
  const s = fs.readFileSync(new URL(f, dataDir), 'utf8');
  return JSON.parse(s.slice(s.indexOf('= [') + 2, s.lastIndexOf(']') + 1));
});
for (const c of cases) { const v = vendors.find(v => v.locationLabel === c[1]); assert(v, c[1]); c[0] = v.name; }
const results = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 900 }, isMobile: width < 500, hasTouch: width < 500, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const req = route.request(), url = new URL(req.url());
      if (req.method() !== 'GET') return route.abort();
      if (url.pathname === '/api/schedule') return route.fulfill({ json: schedule });
      if (url.origin === new URL(base).origin && !url.pathname.startsWith('/api/')) return route.continue();
      return route.abort();
    });
    await context.addInitScript(() => localStorage.setItem('@ipm_schedule_itinerary_onboarding_v1', 'true'));
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const camera = () => page.getByLabel('Select 1A 1-12', { exact: true }).evaluate(el => {
      const m = new DOMMatrix(getComputedStyle(el.parentElement).transform); return [m.a, m.e, m.f];
    });
    const measure = async (id, phase, vendor) => {
      const result = await page.getByLabel(`Select booth ${id}`, { exact: true }).evaluate((cell, vendor) => {
        const layer = cell.parentElement, box = layer.getBoundingClientRect();
        const zoom = new DOMMatrix(getComputedStyle(layer).transform).a;
        const w = parseFloat(cell.style.width) / 100 * parseFloat(getComputedStyle(layer).width) * zoom;
        const h = parseFloat(cell.style.height) / 100 * parseFloat(getComputedStyle(layer).height) * zoom;
        const cx = box.x + parseFloat(cell.style.left) / 100 * box.width + w / 2;
        const cy = box.y + parseFloat(cell.style.top) / 100 * box.height + h / 2;
        return { zoom, cell: { cx, cy, w, h }, highlights: [...layer.querySelectorAll('[data-testid="selected-booth-highlight"], [data-testid="vendor-booth-highlight"], [data-testid="vendor-booth-halo"]')].map(el => {
          const b = el.getBoundingClientRect();
          return { kind: el.dataset.testid, dx: b.x + b.width / 2 - cx, dy: b.y + b.height / 2 - cy, w: b.width, h: b.height };
        }) };
      }, vendor);
      assert.equal(result.highlights.length, vendor ? 3 : 1, `${id} missing overlays`);
      for (const h of result.highlights) {
        assert.ok(Math.abs(h.dx) < 0.16 && Math.abs(h.dy) < 0.16, `${width} ${id} ${phase}: ${JSON.stringify(h)}`);
        if (h.kind !== 'vendor-booth-halo') {
          assert.ok(Math.abs(h.w - result.cell.w) < 0.16);
          assert.ok(Math.abs(h.h - result.cell.h) < 0.16);
        }
      }
      results.push({ width, id, phase, ...result });
    };
    async function exercise(id, vendor) {
      await page.waitForTimeout(400);
      await measure(id, 'focus', vendor);
      const before = await camera();
      await page.mouse.move(width / 2, 210); await page.mouse.wheel(0, -130); await page.waitForTimeout(100);
      assert.ok((await camera())[0] > before[0]);
      await measure(id, 'zoom-in', vendor);
      await page.mouse.wheel(0, 350); await page.waitForTimeout(100);
      await measure(id, 'zoom-out', vendor);
      const panBefore = await camera();
      await page.mouse.down(); await page.mouse.move(width / 2 + 30, 240, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250);
      assert.notDeepEqual(await camera(), panBefore);
      await measure(id, 'pan', vendor);
      console.log('PASS booth', width, id);
    }
    for (const [name, id] of cases) {
      await page.goto(`${base}/map?source=vendors&location=${encodeURIComponent(name)}`);
      await page.getByLabel(`Select booth ${id}`, { exact: true }).waitFor();
      assert.equal(await page.getByPlaceholder('Find a vendor, booth, or stage').inputValue(), name);
      await exercise(id, true);
      await page.screenshot({ path: `${output}/${id}-${width}.png` });
    }
    // First, middle, last of a 12-booth range; 14- and 6-booth ranges.
    for (const [range, id] of [['1A 1-12', '1A-01'], ['1A 1-12', '1A-06'], ['1A 1-12', '1A-12'], ['1A 25-38', '1A-38'], ['3B 1-6', '3B-01'], ['3B 1-6', '3B-06']]) {
      await page.goto(`${base}/map?source=schedule&location=${encodeURIComponent(range)}`);
      const cell = page.getByLabel(`Select booth ${id}`, { exact: true });
      await cell.waitFor(); await page.waitForTimeout(400);
      // A range's focus may put its first/last cell under map chrome at 320px.
      // Dispatch selection directly; bounds checks still use the actual browser layout.
      await cell.evaluate(el => el.click());
      await exercise(id, false);
    }
    await page.getByLabel('Reset map zoom').click(); await page.waitForTimeout(350);
    assert.deepEqual(await camera(), [1, 0, 0]);
    assert.equal(await page.getByTestId('selected-booth-highlight').count(), 0);
    // Actual event-detail navigation plus mapped and unmapped locations.
    await page.goto(`${base}/schedule`); await page.getByText('218 events', { exact: true }).waitFor();
    await page.getByText('Church Service', { exact: true }).last().click();
    await page.getByText('Tap to view on map', { exact: true }).click();
    await page.getByPlaceholder('Find a vendor, booth, or stage').waitFor(); await page.waitForTimeout(500);
    assert.equal(new URL(page.url()).pathname, '/map');
    assert.equal(new URL(page.url()).searchParams.get('location'), 'CKNX Centennial Pavilion (GFO Stage)');
    // Quality Homes - Stage now falls back to MNP Lifestyles Tent parent rect.
    await page.goto(`${base}/map?source=schedule&location=${encodeURIComponent('Quality Homes - Stage')}`);
    await page.getByPlaceholder('Find a vendor, booth, or stage').waitFor(); await page.waitForTimeout(500);
    assert.equal(await page.getByText('This location isn’t mapped yet.', { exact: false }).count(), 0);
    await page.goto(`${base}/map?source=schedule&location=${encodeURIComponent('Unmapped test location')}`);
    await page.getByText('This location isn’t mapped yet.', { exact: false }).waitFor();
    assert.equal(await page.getByTestId('vendor-booth-highlight').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}: 12 booths, four camera states, reset, event navigation, unmapped locations, 218 events`);
    await context.close();
  }
} finally {
  fs.writeFileSync(`${output}/bounds.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
