const assert = require('node:assert/strict');
const {chromium, webkit} = require(process.env.IPM_PLAYWRIGHT_MODULE || '/home/codespace/.npm/_npx/fd3bca3c548369c0/node_modules/playwright');
const origin=process.env.IPM_PREVIEW_URL || 'http://127.0.0.1:8767';
const files={grounds:'grounds-site-map',tented:'tented-city-map-app-ready',rv:'rv-park-detail-map'};
const engine=process.env.IPM_BROWSER==='webkit'?webkit:chromium;
const report=[];
async function setup(browser, options={}) {
 const c=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',...options});
 await c.route('**/*',r=>r.request().method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
 await c.route('https://ipm-backend-eoiw.onrender.com/**',async r=>{if(r.request().method()!=='GET')return r.abort();try { const res=await r.fetch();return await r.fulfill({response:res,headers:{...res.headers(),'access-control-allow-origin':'*'}}); } catch(e) { if (!/disposed|closed|already handled/.test(e.message)) throw e; }});
 return c;
}
async function ready(p,mode) { await p.waitForFunction(mode=>!document.querySelector(`[data-testid="map-artwork-${mode}-loading"]`)&&!document.querySelector(`[data-testid="map-artwork-${mode}-error"]`)&&document.querySelector(`img[src*="${{grounds:'grounds-site-map',tented:'tented-city-map-app-ready',rv:'rv-park-detail-map'}[mode]}"]`)?.complete,mode); }
(async()=>{const b=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});try{
 // Real delayed resources: the map image is hidden, while selector/search stay usable.
 for(const mode of ['grounds','tented','rv']) {
  const c=await setup(b),p=await c.newPage();let fail=false;
  await c.route(`**/*${files[mode]}*`,async r=>{await new Promise(res=>setTimeout(res,600));return fail?r.abort():r.continue()});
  await p.goto(origin+'/map?mapType='+mode);await p.getByTestId(`map-artwork-${mode}-loading`).waitFor();
  assert.equal(await p.locator(`img[src*="${files[mode]}"]`).evaluate(el=>{for(let n=el;n;n=n.parentElement)if(getComputedStyle(n).opacity==='0')return true;return false}),true);
  assert.ok(await p.getByTestId('map-mode-selector').isVisible());await ready(p,mode);
  assert.equal(await p.getByTestId('booth-divider').count(),284);
  report.push(mode+' delayed load/reveal PASS');
  // A new document with failed artwork must offer retry; successful retry must recover.
  fail=true;await p.reload();await p.getByTestId(`map-artwork-${mode}-error`).waitFor();fail=false;await p.getByRole('button',{name:'Try again',exact:true}).click();await ready(p,mode);
  report.push(mode+' failure/retry PASS');await c.close();
 }
 const c=await setup(b),p=await c.newPage();await p.goto(origin+'/map');await ready(p,'grounds');
 assert.equal(await p.getByTestId('booth-divider').count(),284);
 await p.getByTestId('map-mode-tented').click();await ready(p,'tented');assert.equal(await p.getByTestId('booth-divider').count(),284);
 const search=p.getByPlaceholder('Find a vendor, booth, stage, or place').filter({visible:true});await search.fill('1A-01');await search.press('Enter');await p.waitForTimeout(350);
 const q=await search.inputValue();const cam=()=>p.locator('img[src*="tented-city-map-app-ready"]').evaluate(el=>el.closest('[style*="transform:"]').style.transform);
 // Wait for the selected-booth camera animation before snapshotting lifecycle state.
 await p.waitForFunction(()=>{const el=document.querySelector('img[src*="tented-city-map-app-ready"]').closest('[style*="transform:"]');return new DOMMatrix(getComputedStyle(el).transform).a>1.1;});
 await p.waitForTimeout(400);
 const before=await cam();await p.getByTestId('map-mode-rv').click();await ready(p,'rv');assert.equal(await p.getByTestId('booth-divider').count(),284);
 await p.getByTestId('map-mode-tented').click();await ready(p,'tented');assert.equal(await search.inputValue(),q);assert.equal(await cam(),before);report.push('Tented City production lifecycle retains selection/camera PASS');
 // Route parameters still override a previous session.
 await p.goto(origin+'/map?mapType=tented&location=The%20Beyond%20Wireless%20Stage');await ready(p,'tented');await p.getByTestId('selected-stage-highlight').waitFor();report.push('MNP PASS');
 await p.goto(origin+'/map?mapType=tented&location=Ontario%20Government');await ready(p,'tented');assert.equal(await p.getByTestId('vendor-booth-highlight').count(),1);
 assert.deepEqual(await p.getByTestId('vendor-booth-highlight').evaluate(e=>({left:e.style.left,top:e.style.top,width:e.style.width,height:e.style.height,fill:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderColor})),
 {left:'37.754%',top:'52.744%',width:'4.548%',height:'3.947%',fill:'rgba(0, 229, 255, 0.45)',border:'rgb(255, 214, 0)'});
 assert.equal(await p.getByTestId('selected-parent-range-fill').count(),0);
 await p.getByText('3B-19-24',{exact:true}).first().waitFor();report.push('Ontario approved exact six-booth union PASS');
 await c.close();
 // Switch during a stalled request: old callbacks must not affect the new map.
 const s=await setup(b),sp=await s.newPage();await s.route('**/*grounds-site-map*',async r=>{await new Promise(res=>setTimeout(res,1800));try{await r.continue()}catch{}});
 await sp.goto(origin+'/map');await sp.getByTestId('map-artwork-grounds-loading').waitFor();await sp.getByTestId('map-mode-rv').click();await ready(sp,'rv');await sp.waitForTimeout(1900);assert.equal(await sp.getByTestId('map-artwork-rv-loading').count(),0);assert.equal(await sp.locator('img[src*="grounds-site-map"]').count(),0);report.push('switch during load PASS');await s.close();
 // A stalled decode must time out. A late callback from before retry cannot reveal it.
 const t=await setup(b),tp=await t.newPage();
 await tp.addInitScript(()=>{window.decodeGates=[];const original=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=function(){return this.src.includes('grounds-site-map')?new Promise(resolve=>window.decodeGates.push(resolve)):original.call(this)}});
 await tp.goto(origin+'/map');await tp.waitForFunction(()=>window.decodeGates.length===1);
 await tp.getByTestId('map-artwork-grounds-error').waitFor({timeout:18000});
 await tp.getByRole('button',{name:'Try again',exact:true}).click();await tp.waitForFunction(()=>window.decodeGates.length===2);
 await tp.evaluate(()=>window.decodeGates[0]());await tp.waitForTimeout(100);
 assert.ok(await tp.getByTestId('map-artwork-grounds-loading').isVisible());
 await tp.evaluate(()=>window.decodeGates[1]());await ready(tp,'grounds');report.push('15-second timeout / retry / stale callback PASS');await t.close();
 // Decode rejection (not a network error) must not strand a usable SVG.
 const d=await setup(b),dp=await d.newPage();await dp.addInitScript(()=>{const original=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=function(){return this.src.includes('tented-city-map-app-ready')?Promise.reject(new Error('SVG decode fixture')):original.call(this)}});
 await dp.goto(origin+'/map?mapType=tented');await ready(dp,'tented');report.push('SVG decode rejection fallback PASS');await d.close();
 // Previously unvisited artwork is unavailable offline: searchable data remains usable.
 const u=await setup(b),up=await u.newPage();await up.goto(origin+'/map');await ready(up,'grounds');await u.setOffline(true);
 await up.getByTestId('map-mode-rv').click();await up.getByTestId('map-artwork-rv-error').waitFor();
 await up.getByTestId('rv-site-search').fill('M27');await up.getByText('RV Site M27',{exact:true}).click();await up.getByTestId('rv-site-title').waitFor();report.push('offline unavailable artwork / M27 data / bounded error PASS');await u.close();
 // Preserve HTTP caching in this test: Playwright routing would disable it.
 if(engine===chromium) {
 const warm=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),wp=await warm.newPage(),cd=await warm.newCDPSession(wp);
 await cd.send('Network.enable');await cd.send('Network.setBlockedURLs',{urls:['*wonderpush*','*webpushr*']});await cd.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 cd.on('Fetch.requestPaused',async e=>{try{if(e.request.method!=='GET')return await cd.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'});
 if(e.request.url.includes('ipm-backend-eoiw.onrender.com')){const r=await fetch(e.request.url);return await cd.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:r.status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(await r.arrayBuffer()).toString('base64')})}
 await cd.send('Fetch.continueRequest',{requestId:e.requestId})}catch{}});
 await wp.goto(origin+'/');await wp.waitForFunction(()=>performance.getEntriesByName('ipm-map-preload-rv-end').length>0,{},{timeout:30000});
 assert.equal(await wp.getByTestId('booth-divider').count(),0);await warm.setOffline(true);await wp.getByText('Map',{exact:true}).click();
 for(const mode of ['grounds','tented','rv']){await wp.getByTestId('map-mode-'+mode).click();await ready(wp,mode)}
 report.push('offline same-document browser-cached artwork: all three PASS');await warm.close();
 }
 console.log(report.join('\n'));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
