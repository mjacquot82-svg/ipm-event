// Compare against the approved candidate served locally; never write remote data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.IPM_PLAYWRIGHT_MODULE || '/tmp/ipm-browser-tools/node_modules/playwright');
const { PNG } = require('/tmp/ipm-browser-tools/node_modules/pngjs');
const origin = process.env.IPM_PREVIEW_URL || 'http://127.0.0.1:8851';
const baseline = process.env.IPM_BASELINE_URL || 'http://127.0.0.1:8850';
const out = process.env.IPM_HEADER_OUTPUT || path.resolve(__dirname, '../../diagnostics/grounds-phone-header');
const widths = [320, 360, 375, 390, 393, 412, 430, 767, 768, 1024, 1280, 1366, 1440, 1600, 1920, 2560];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await context.route('**/*', r => r.request().method() !== 'GET' || /wonderpush|webpushr|google-analytics|ipm-backend/.test(r.request().url()) ? r.abort() : r.continue());
    const candidate = await context.newPage(), approved = await context.newPage(), errors = [];
    candidate.on('pageerror', e => errors.push(e.message));
    const ready = async p => {
      await p.waitForFunction(() => document.querySelector('img[src*="grounds-site-map"]')?.complete && !document.querySelector('[data-testid="map-artwork-grounds-loading"]'));
      await p.evaluate(() => document.fonts.ready);
    };
    await candidate.goto(origin + '/map'); await ready(candidate);
    await approved.goto(baseline + '/map'); await ready(approved);
    const records = [];
    const geometry = p => p.evaluate(() => {
      const q = id => document.querySelector(`[data-testid="${id}"]`);
      const box = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
      const img = document.querySelector('img[src*="grounds-site-map"]');
      return { image: box(img), source: img.getAttribute('src'), natural: [img.naturalWidth, img.naturalHeight],
        search: box(q('grounds-map-search').parentElement), selector: box(q('map-mode-selector')),
        crop: q('grounds-artwork-crop') ? box(q('grounds-artwork-crop')) : null,
        viewport: q('grounds-map-viewport') ? box(q('grounds-map-viewport')) : null,
        walkerton: box(q('grounds-walkerton')), notice: box(q('grounds-traffic-notice')),
        noticeText: q('grounds-traffic-notice').textContent,
        routes: ['TRAFFIC-01', 'TRAFFIC-02', 'TRAFFIC-03'].map(id => q(id).outerHTML),
        routeCoordinates: ['TRAFFIC-01', 'TRAFFIC-02', 'TRAFFIC-03'].map(id => {
          const s = q(id).style, size = img.getBoundingClientRect();
          return [parseFloat(s.left) / size.width, (parseFloat(s.top) + 6) / size.height,
            parseFloat(s.width) / size.width, s.transform];
        }),
        overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    for (const width of widths) {
      const size = { width, height: width < 768 ? 844 : 900 };
      for (const p of [approved, candidate]) {
        await p.setViewportSize(size);
        await p.getByTestId('grounds-fit-reset').click();
        await p.waitForTimeout(350);
      }
      const current = await geometry(candidate), base = await geometry(approved);
      assert.deepEqual(current.natural, [1344, 2006]);
      assert.equal(current.source, base.source, 'original JPEG retained');
      if (current.image.width === base.image.width) {
        assert.deepEqual(current.routes, base.routes, 'route geometry, direction and styling unchanged');
      } else {
        // At height-constrained widths, the whole artwork fits a different frame;
        // its original route coordinates and angles must still match exactly.
        current.routeCoordinates.forEach((route, i) => route.forEach((value, j) => {
          if (typeof value === 'number') assert.ok(Math.abs(value - base.routeCoordinates[i][j]) < .00005,
            JSON.stringify({ width, route: i, coordinate: j, value, baseline: base.routeCoordinates[i][j] }));
          else assert.equal(value, base.routeCoordinates[i][j]);
        }));
      }
      assert.deepEqual(current.search, base.search, 'search position retained');
      assert.deepEqual(current.selector, base.selector, 'selector and safe-area position retained');
      assert.equal(current.noticeText, base.noticeText);
      assert.equal(current.overflow, false);
      if (width < 768) {
        const { crop, image, viewport, search, walkerton, notice } = current;
        assert.ok(crop && Math.abs((crop.y - image.y) / image.height - 182 / 2006) < .0001,
          'title and orange line are clipped at their source-image boundary');
        assert.ok(Math.abs(crop.y - viewport.y) < .1, 'no leftover heading space');
        assert.ok(Math.abs(crop.y - search.y - search.height - 8) < .1, '8px gap below search');
        assert.ok(crop.y + crop.height <= viewport.y + viewport.height + 1, 'whole map below header fits');
        assert.ok(walkerton.y >= crop.y && walkerton.y + walkerton.height <= crop.y + crop.height);
        assert.ok(notice.y >= crop.y && notice.y + notice.height <= crop.y + crop.height);
        assert.ok(notice.x >= 0 && notice.x + notice.width <= width);
      } else {
        assert.equal(current.crop, null, 'desktop header and decoration remain unmasked');
        assert.deepEqual(current.image, base.image, 'desktop artwork geometry unchanged');
        // Exact rendered pixels include the title, orange line and all overlays.
        const a = PNG.sync.read(await candidate.screenshot({ clip: current.image }));
        const b = PNG.sync.read(await approved.screenshot({ clip: base.image }));
        assert.deepEqual(a.data, b.data, 'desktop map pixels match approved candidate');
      }
      await candidate.screenshot({ path: path.join(out, `header-${width}.png`) });
      records.push({ width, ...current });
    }
    await candidate.setViewportSize({ width: 390, height: 844 });
    await candidate.getByTestId('grounds-fit-reset').click();
    await candidate.getByTestId('grounds-map-search').fill('West Parking');
    await candidate.getByText('West Parking Lot', { exact: true }).first().click();
    await candidate.locator('[data-testid^="grounds-zone-highlight-"]').waitFor();
    await candidate.getByTestId('grounds-fit-reset').click();
    assert.equal(await candidate.getByTestId('grounds-map-search').inputValue(), '');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'header-browser.json'), JSON.stringify(records, null, 2));
    console.log('PASS phone title/line crop, no blank space, search/selector unchanged, desktop pixel identity, original JPEG/routes, highlights, Fit; all widths and 767/768 boundary');
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
