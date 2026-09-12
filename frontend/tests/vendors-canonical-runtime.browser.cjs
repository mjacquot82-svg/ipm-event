const assert = require('node:assert/strict');
const { chromium } = require(process.env.IPM_PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const origin = process.env.IPM_VENDOR_PREVIEW_URL;
  assert.ok(origin && !/^https:\/\/(theipm\.ca|staging\.theipm\.ca)(\/|$)/.test(origin), 'Explicit preview URL required');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let releaseRequest;
    const pending = new Promise(resolve => { releaseRequest = resolve; });
    const vendorUrls = [];
    let rawCount;
    await page.addInitScript(() => {
      localStorage.setItem('ipm_supabase_cache:ipm-2026-production:vendors', JSON.stringify({
        data: { vendors: [] }, lastSuccessfulUpdate: new Date().toISOString(), cacheAge: 0,
      }));
    });
    await page.route('**/*', async route => {
      const req = route.request();
      if (req.method() !== 'GET' || /wonderpush|webpushr|google-analytics/.test(req.url())) return route.abort();
      if (/\/api\/vendors(?:\?|$)/.test(req.url())) {
        vendorUrls.push(req.url());
        await pending;
      }
      return route.continue();
    });
    page.on('response', async response => {
      if (/\/api\/vendors(?:\?|$)/.test(response.url())) rawCount = (await response.json()).vendors.length;
    });
    await page.goto(`${origin}/vendors`);
    await page.getByText('Loading vendors…', { exact: true }).waitFor();
    assert.equal(await page.getByText('No Matching Vendors', { exact: true }).count(), 0);
    releaseRequest();
    await page.getByText('224 vendors', { exact: true }).waitFor({ timeout: 60000 });
    assert.equal(rawCount, 224);
    assert.deepEqual(vendorUrls, [`${origin}/api/vendors`]);
    for (const [query, name, location] of [
      ['CAN-AM', 'Can-Am Demo Area, Montreal, QC', 'WEST-02'],
      ['Valard', 'Valard Construction, Vaughan', 'EAST-06'],
      ['Bambrook', 'Bambrook Farm Equipment', '1A-05'],
      ['Cottrill', 'Cottrill Heavy Equipment, Kincardine', '2A-05'],
      ['Ontario Government', 'Ontario Government', '3B-19-24'],
    ]) {
      await page.getByText('All', { exact: true }).click();
      await page.getByPlaceholder('Search vendors').fill(query);
      await page.getByText(name, { exact: true }).waitFor();
      assert.ok((await page.locator('body').innerText()).includes(location), `${query} location`);
      await page.getByText('1 of 224 vendors', { exact: true }).waitFor();
      console.log('PASS', query, location);
    }
    await page.getByPlaceholder('Search vendors').fill('no-such-vendor-xyz');
    await page.getByText('No Matching Vendors', { exact: true }).waitFor();
    console.log('PASS canonical request, raw/UI count 224, pending loading, searched no-results');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
