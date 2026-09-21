const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.IPM_PLAYWRIGHT_MODULE || '/tmp/ipm-browser-tools/node_modules/playwright');

const template = fs.readFileSync(path.join(__dirname, '..', 'public', 'webpushr-sw.js'), 'utf8');
const maps = [
  '/assets/assets/images/grounds-site-map.f0f749ac0d9f6b3f727be83771fd128e.jpg',
  '/assets/assets/images/tented-city-map-app-ready.b2d9ba7f15bcc227c095b98b2c912157.svg',
  '/assets/assets/images/rv-park-detail-map.05f87e0e3ae1bc57c49a84ae27f5df12.png',
];
const shell = version => ['/', '/index.html', `/_expo/static/js/web/entry-${version}.js`];
const worker = version => template
  .replace('https://cdn.by.wonderpush.com/sdk/1.1/wonderpush-loader.min.js', '/provider-stub.js')
  .replace("'development'", `'${version}'`)
  .replace("['/', '/index.html', '/manifest.json']", JSON.stringify(shell('A')))
  .replace('const IPM_MAP_ARTWORK_ASSETS = [];', `const IPM_MAP_ARTWORK_ASSETS = ${JSON.stringify(version === 'B' ? maps : [])};`);

const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

(async () => {
  let workerVersion = 'A';
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    res.setHeader('Cache-Control', 'no-store');
    if (pathname === '/webpushr-sw.js') {
      res.setHeader('Content-Type', 'application/javascript');
      return res.end(worker(workerVersion));
    }
    if (pathname === '/provider-stub.js') {
      res.setHeader('Content-Type', 'application/javascript');
      return res.end('self.WonderPush = [];');
    }
    if (pathname.startsWith('/_expo/static/js/web/entry-')) {
      res.setHeader('Content-Type', 'application/javascript');
      return res.end('');
    }
    if (maps.includes(pathname)) {
      res.setHeader('Content-Type', pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
      return res.end(pathname.endsWith('.svg') ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>' : onePixelPng);
    }
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<!doctype html><body>
      <script>navigator.serviceWorker.register('/webpushr-sw.js?webKey=fixture', { scope: '/' });</script>
      <img data-map="grounds" src="${maps[0]}"><img data-map="tented" src="${maps[1]}"><img data-map="rv" src="${maps[2]}">
      <script src="/_expo/static/js/web/entry-A.js"></script>
    </body>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => navigator.serviceWorker.controller && navigator.serviceWorker.ready);
    assert.deepEqual(await page.evaluate(async maps => {
      const values = await Promise.all(maps.map(async map => Boolean(await caches.match(map))));
      return values;
    }, maps), [false, false, false]);

    workerVersion = 'B';
    await page.evaluate(() => navigator.serviceWorker.ready.then(registration => registration.update()));
    await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.ready).waiting));
    assert.deepEqual(await page.evaluate(async maps => Promise.all(maps.map(async map => Boolean(await caches.match(map)))), maps), [true, true, true]);

    await page.close();
    await new Promise(resolve => setTimeout(resolve, 500));
    await context.setOffline(true);
    const offline = await context.newPage();
    await offline.goto(origin, { waitUntil: 'domcontentloaded' });
    await offline.waitForFunction(() => [...document.querySelectorAll('img[data-map]')].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await offline.locator('img[data-map]').count(), 3);
    console.log('PASS existing install upgrade warms all three map artworks before offline reopen');
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
