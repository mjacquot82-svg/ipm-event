const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.IPM_PLAYWRIGHT || '/tmp/ipm-browser-tools/node_modules/playwright');
const origin = process.env.IPM_PREVIEW_URL || 'https://staging.theipm.ca';
const out = path.resolve(__dirname, '../../.artifacts/grounds-full-artwork');
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch({ args: ['--no-sandbox'] });
 const results = [];
 try {
  for (const [width, height] of [[320,568],[360,800],[390,844],[412,915],[768,1024],[1440,900]]) {
   const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 768, isMobile: width < 768, serviceWorkers: 'block' });
   await context.route('**/*', route => route.request().method() !== 'GET' || /wonderpush|webpushr|google-analytics/.test(route.request().url()) ? route.abort() : route.continue());
   const page = await context.newPage();
   await page.goto(origin + '/map');
   await page.waitForFunction(() => document.querySelector('img[src*="grounds-site-map"]')?.complete && !document.querySelector('[data-testid="map-artwork-grounds-loading"]'));
   await page.waitForTimeout(600);
   const bounds = await page.evaluate(() => {
    const image = document.querySelector('img[src*="grounds-site-map"]');
    const rect = e => { const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };
    const clipping = [];
    for (let e = image.parentElement; e; e = e.parentElement) if (/hidden|clip|scroll|auto/.test(getComputedStyle(e).overflow)) clipping.push(rect(e));
    return { image:rect(image), viewport:rect(document.querySelector('[data-testid="grounds-map-viewport"]')), overlay:rect(document.querySelector('[data-testid="grounds-traffic-overlay"]')), clipping, crop:!!document.querySelector('[data-testid="grounds-artwork-crop"]'), natural:[image.naturalWidth,image.naturalHeight] };
   });
   await page.screenshot({ path:path.join(out, `fit-${width}.png`) });
   fs.writeFileSync(path.join(out, `bounds-${width}.json`), JSON.stringify(bounds,null,2));
   const {image:i,viewport:v,overlay:o} = bounds;
   assert.equal(bounds.crop, false, 'phone artwork crop must not exist');
   assert.deepEqual(bounds.natural,[1344,2006]);
   assert.ok(Math.abs(i.width/i.height-1344/2006)<.001,'source aspect ratio');
   for (const r of [v,...bounds.clipping]) assert.ok(i.x>=r.x-1 && i.y>=r.y-1 && i.right<=r.right+1 && i.bottom<=r.bottom+1,`all source edges inside clipping ancestor at ${width}: ${JSON.stringify({i,r})}`);
   assert.ok(i.x>=-1 && i.y>=-1 && i.right<=width+1 && i.bottom<=height+1,'screen bounds');
   assert.ok(Math.abs(i.x+i.width/2-v.x-v.width/2)<1 && Math.abs(i.y+i.height/2-v.y-v.height/2)<1,'centered');
   assert.ok(Math.abs(i.width-v.width)<1 || Math.abs(i.height-v.height)<1,'maximum complete fit');
   for (const key of ['x','y','width','height']) assert.ok(Math.abs(i[key]-o[key])<1,'traffic shares artwork coordinates');
   results.push({width,height,...bounds});
   await context.close();
  }
  fs.writeFileSync(path.join(out,'initial-fit-results.json'),JSON.stringify(results,null,2));
  console.log('PASS complete initial artwork at 320, Android 360/412, 390, tablet 768, desktop 1440; all clipping ancestors, aspect, centering, maximum fit and overlay bounds');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
