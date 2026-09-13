// Run against a production build; simulated CSS environment insets are not physical-device evidence.
const assert = require('node:assert/strict');
const { chromium, webkit } = require(process.env.IPM_PLAYWRIGHT_MODULE || '/tmp/ipm-browser-tools/node_modules/playwright');
const origin = process.env.IPM_PREVIEW_URL || 'http://127.0.0.1:8767';
async function hit(locator, width) {
  await locator.waitFor();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0);
  assert.ok(box.x >= -1 && box.x + box.width <= width + 1, JSON.stringify(box));
  assert.ok(await locator.evaluate(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return el === hit || el.contains(hit); }), 'control must receive hit tests');
  return box;
}
(async () => {
 const backendCache=new Map();
 for (const engine of (process.env.IPM_BROWSER === 'webkit' ? [webkit] : process.env.IPM_BROWSER === 'chromium' ? [chromium] : [chromium, webkit])) {
  const browser = await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});
  try {
   for (const width of (process.env.IPM_WIDTHS ? process.env.IPM_WIDTHS.split(',').map(Number) : [320,375,390,393,430,360,412,1440])) {
    const insets = [320,375,390,393,430].includes(width) ? [0,20,44,59] : [0];
    for (const inset of insets) {
    for (const displayMode of (process.env.IPM_DISPLAY_MODE ? [process.env.IPM_DISPLAY_MODE] : engine===webkit && width<500 ? ['browser','standalone'] : ['browser'])) {
     const context = await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',isMobile:width<500,hasTouch:width<500,...(width<500?{userAgent:engine===webkit?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'}:{})});
     await context.addInitScript(mode=>{Object.defineProperty(navigator,'standalone',{configurable:true,value:mode==='standalone'});const original=window.matchMedia.bind(window);window.matchMedia=q=>{const result=original(q);if(q==='(display-mode: standalone)')Object.defineProperty(result,'matches',{configurable:true,value:mode==='standalone'});return result;};},displayMode);
     // Feed simulated OS insets through the actual safe-area provider, not the app layout.
     await context.addInitScript(inset => {
      const original=window.getComputedStyle;
      window.getComputedStyle=function(el,...rest) {
       const computed=original.call(this,el,...rest);
       if(el.style.paddingTop.includes('safe-area-inset-top')) return new Proxy(computed,{get(target,key){if(key==='paddingTop')return inset+'px'; const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
       return computed;
      };
     },inset);
     const page = await context.newPage();
     const errors=[];page.on('pageerror',e=>errors.push(e.message));
     await page.route('**/*',r=>r.request().method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
     // Proxy read-only backend responses to avoid localhost CORS in WebKit.
     await page.route('https://ipm-backend-eoiw.onrender.com/**',async r=>{if(r.request().method()!=='GET')return r.abort();try{const url=r.request().url();if(!backendCache.has(url))backendCache.set(url,fetch(url).then(async response=>({status:response.status,contentType:response.headers.get('content-type')||'application/json',body:await response.text(),headers:{'access-control-allow-origin':'*'}})));await r.fulfill(await backendCache.get(url));}catch(error){if(!/Route is already handled|Request context disposed|Target page.*closed/.test(error.message))throw error;}});
     await page.goto(origin+'/map');
     const selector=page.getByTestId('map-mode-selector');await selector.waitFor();
     for(const mode of ['grounds','tented','rv']) {
      const tab=page.getByTestId('map-mode-'+mode);const box=await hit(tab,width);
      assert.ok(box.y>=inset+8,`selector above inset ${inset}: ${box.y}`);
      await tab.click();
      const search=mode==='grounds'?page.getByTestId('grounds-map-search'):mode==='rv'?page.getByTestId('rv-site-search'):page.getByPlaceholder('Find a vendor, booth, stage, or place').filter({visible:true});
      const sb=await hit(search,width);assert.ok(sb.y>=box.y+box.height,'search below selector');
      await search.fill(mode==='rv'?'M27':'Tractor');await search.fill('');
      if(mode==='grounds')await page.getByTestId('grounds-fit-reset').click();
      if(mode==='rv')await page.getByTestId('rv-map-fit-reset').click();
      assert.ok(900-sb.y-sb.height>400,'usable map height');
     }
     assert.deepEqual(errors,[]);
     console.log('PASS',engine.name(),displayMode,width,'top inset',inset,'all modes, labels, search, hit tests, fit, no clipping');
     if(width===393&&inset===59)await page.screenshot({path:`../diagnostics/production-iphone-safe-area/${engine.name()}-393-59.png`});
     await page.unrouteAll({behavior:'ignoreErrors'});await context.close();
    }
   }}
  } finally {await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
