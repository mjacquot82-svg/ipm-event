const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('/tmp/ipm-browser-tools/node_modules/playwright');
const { PNG } = require('/tmp/ipm-browser-tools/node_modules/pngjs');
const origin = process.env.IPM_PREVIEW_URL || 'http://127.0.0.1:8860';
const baseline = process.env.IPM_BASELINE_URL || 'http://127.0.0.1:8861';
const out = process.env.IPM_LAYERS_OUTPUT || path.resolve(__dirname, '../../diagnostics/grounds-layers');
const widths = [320, 360, 375, 390, 393, 412, 430, 768, 1024, 1280, 1366, 1440, 1600, 1920, 2560];
const ready = p => p.waitForFunction(() => document.querySelector('img[src*="grounds-site-map"]')?.complete && !document.querySelector('[data-testid="map-artwork-grounds-loading"]'));
const image = p => p.locator('img[src*="grounds-site-map"]');
const camera = p => image(p).evaluate(e => e.closest('[style*="transform:"]').style.transform);
const zoom = p => image(p).evaluate(e => new DOMMatrix(getComputedStyle(e.closest('[style*="transform:"]')).transform).a);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await c.route('**/*', r => r.request().method() !== 'GET' || /wonderpush|webpushr|google-analytics|ipm-(?:staging-)?backend/.test(r.request().url()) ? r.abort() : r.continue());
    const p = await c.newPage(), base = await c.newPage(), errors = [], records = [];
    p.on('pageerror', e => errors.push(e.message));
    let downloads = 0; p.on('request', r => { if (/grounds-site-map/.test(r.url())) downloads++; });
    await p.goto(origin + '/map'); await ready(p);
    await base.goto(baseline + '/map'); await ready(base);
    assert.equal(await p.getByTestId('grounds-view-general').getAttribute('aria-selected'), 'true');
    for (const width of widths) {
      const size = { width, height: width < 768 ? 844 : 900 };
      for (const page of [p, base]) { await page.setViewportSize(size); await page.getByTestId('grounds-fit-reset').click(); await ready(page); await page.waitForTimeout(300); await page.evaluate(() => document.fonts.ready); }
      await p.evaluate(() => window.originalGrounds = document.querySelector('img[src*="grounds-site-map"]'));
      assert.deepEqual(await p.getByTestId('grounds-view-selector').getByRole('tab').allTextContents(), ['General', 'Parking']);
      assert.equal(await p.getByTestId('grounds-view-traffic').count(), 0);
      const before = downloads, initialCamera = await camera(p);
      for (const view of ['general', 'parking', 'general', 'parking', 'general']) {
        await p.getByTestId('grounds-view-' + view).click();
        assert.equal(await p.evaluate(() => window.originalGrounds === document.querySelector('img[src*="grounds-site-map"]') && window.originalGrounds.complete && window.originalGrounds.naturalWidth === 1344), true, 'same mounted aerial image');
        assert.equal(await p.getByTestId('map-artwork-grounds-loading').count(), 0, 'no blank/loading transition');
        assert.equal(downloads, before, 'no new map download between layers');
        assert.equal(await camera(p), initialCamera, 'view selection retains camera');
        assert.equal(await p.locator('[data-testid^="TRAFFIC-"]').count(), view === 'general' ? 3 : 0);
        assert.equal(await p.getByTestId('grounds-flow-caption').count(), view === 'general' ? 1 : 0);
        assert.equal(await p.getByTestId('grounds-traffic-notice').count(), 1);
        assert.equal(await p.locator('[data-testid^="grounds-parking-"][role="button"]').count(), view === 'parking' ? 15 : 0);
        for (const id of ['grounds-walkerton','grounds-horse-plowing-label','grounds-road-Durham-Rd','grounds-road-Greenock-Brant','grounds-road-Bruce-Road-3','grounds-road-Highway-9']) assert.equal(await p.getByTestId(id).count(), 1);
        assert.equal(await p.getByTestId('grounds-view-selector').boundingBox().then(r=>r.height), width < 768 ? 60 : 52, 'selector height unchanged');
        const layout = await p.evaluate(() => {
          const q = id => document.querySelector(`[data-testid="${id}"]`), rect = e => { const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height }; };
          return { control: rect(q('grounds-view-selector')), viewport: rect(q('grounds-map-viewport')), search: rect(q('grounds-map-search').parentElement), selector: rect(q('map-mode-selector')), crop: q('grounds-artwork-crop') ? rect(q('grounds-artwork-crop')) : null, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        assert.equal(layout.overflow, false);
        assert.ok(layout.control.x >= 0 && layout.control.x + layout.control.width <= width);
        assert.ok(layout.control.y >= layout.viewport.y + layout.viewport.height - 1, 'layer control uses reserved footer, not map/search space');
        assert.ok(layout.search.y >= layout.selector.y + layout.selector.height);
        if (width < 768) assert.ok(layout.crop && Math.abs(layout.crop.y - layout.search.y - layout.search.height - 8) < 1, 'mobile heading stays cropped with no new header space');
        for (const tab of ['general','parking']) assert.ok(await p.getByTestId('grounds-view-'+tab).evaluate(e => { const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit); }), 'layer control remains clickable');
        if (view === 'general') {
          const clips = await Promise.all([p, base].map(page => page.evaluate(() => { const e=document.querySelector('[data-testid="grounds-artwork-crop"]') || document.querySelector('img[src*="grounds-site-map"]');const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}; })));
          assert.deepEqual(clips[0], clips[1], 'approved artwork geometry unchanged');
          const currentPixels = await p.screenshot({clip:clips[0]}), basePixels = await base.screenshot({clip:clips[1]});
          fs.writeFileSync(path.join(out, `traffic-crop-${width}.png`), currentPixels);
          fs.writeFileSync(path.join(out, `base-crop-${width}.png`), basePixels);
          const a = PNG.sync.read(currentPixels), b = PNG.sync.read(basePixels);
          assert.equal(a.width,b.width);assert.equal(a.height,b.height);
          let totalDelta=0,changed=0;
          for(let i=0;i<a.data.length;i+=4){let delta=0;for(let j=0;j<4;j++){const d=Math.abs(a.data[i+j]-b.data[i+j]);totalDelta+=d;delta=Math.max(delta,d);}if(delta)changed++;}
          // Different compositor batches after a view switch produce tiny edge
          // antialiasing differences. Reject visible changes, not that noise.
          const meanDelta=totalDelta/a.data.length;
          assert.ok(meanDelta<=.025, JSON.stringify({width,meanDelta,changed}));
        }
        await p.screenshot({ path:path.join(out, `${view}-${width}.png`) });
        records.push({width,view,...layout});
      }
      await p.getByTestId('grounds-view-parking').click();
      await p.getByTestId('grounds-parking-9').click();
      await p.getByTestId('grounds-parking-info').getByText('#9 · RV Park Entrance', { exact:true }).waitFor();
      await p.getByLabel('Close parking information').click();
    }
    await p.setViewportSize({width:390,height:844});await p.getByTestId('grounds-fit-reset').click();await p.waitForTimeout(350);
    await p.getByTestId('grounds-view-parking').click();
    for(const id of ['1','2','3','4A','4B','5','7','8','9','10','11','12','13','14','accessible']) {
      await p.getByTestId('grounds-parking-'+id).click();
      const card=p.getByTestId('grounds-parking-info');await card.waitFor();
      assert.ok((await card.textContent()).includes(id==='accessible'?'Accessible Parking':'#'+id+' ·'));
      if(['1','2'].includes(id))assert.ok((await card.textContent()).includes('Buses Only'));
      await p.getByLabel('Close parking information').click();
    }
    for(const view of ['general','parking']) {
      await p.getByTestId('grounds-view-'+view).click();await p.getByTestId('grounds-fit-reset').click();await p.waitForTimeout(300);
      const box=await image(p).boundingBox(),x=box.x+box.width*.72,y=box.y+box.height*.55;
      await p.mouse.move(x,y);await p.mouse.wheel(0,-450);await p.waitForTimeout(300);assert.ok(await zoom(p)>1.1);
      const before=await camera(p);await p.mouse.down();await p.mouse.move(x-40,y+25,{steps:8});await p.mouse.up();await p.waitForTimeout(300);assert.notEqual(await camera(p),before);
      await p.getByTestId('grounds-fit-reset').click();await p.waitForTimeout(300);assert.equal(await zoom(p),1);
    }
    await p.getByTestId('grounds-map-search').fill('West Parking');await p.getByText('West Parking Lot',{exact:true}).first().click();
    const selected=p.locator('[data-testid^="grounds-zone-highlight-"]');await selected.waitFor();await p.waitForTimeout(350);
    const selectedCamera=await camera(p);
    for(const view of ['general','parking']) {await p.getByTestId('grounds-view-'+view).click();await selected.waitFor();assert.equal(await camera(p),selectedCamera);}
    await p.getByTestId('grounds-fit-reset').click();
    await p.getByTestId('grounds-map-search').fill('Ontario Government');await p.getByText('Ontario Government',{exact:true}).first().click();await p.getByTestId('vendor-booth-highlight').waitFor();
    await p.getByTestId('map-mode-grounds').click();await ready(p);await p.getByTestId('grounds-view-selector').waitFor();
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({records,downloads,errors},null,2));
    console.log('PASS 15 widths × 2 views; repeated switching, same mounted image/no downloads/no blank map, approved traffic rendering, all POI taps, control/footer, pan/zoom/Fit, persistent search/highlights and vendor Find-on-Map');
    await c.close();
  } finally { await b.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
