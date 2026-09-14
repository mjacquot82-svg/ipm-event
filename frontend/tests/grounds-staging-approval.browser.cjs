const assert = require('node:assert/strict');
const { chromium } = require('/tmp/ipm-browser-tools/node_modules/playwright');
const origin = process.env.IPM_PREVIEW_URL || 'https://staging.theipm.ca';
assert.ok(origin === 'https://staging.theipm.ca' || origin.startsWith('http://127.0.0.1:'));
(async () => {
 const b = await chromium.launch({ args: ['--no-sandbox'] });
 try {
  const c = await b.newContext({ serviceWorkers: 'block' });
  await c.route('**/*', r => r.request().method() !== 'GET' || /wonderpush|webpushr|google-analytics/.test(r.request().url()) ? r.abort() : r.continue());
  if (origin.startsWith('http:')) await c.route('https://ipm-staging-backend.onrender.com/**', async r => {
   if(r.request().method()!=='GET')return r.abort();
   try { const response=await r.fetch();await r.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':'*'}}); } catch(e) { if(!/disposed|closed|already handled/.test(e.message))throw e; }
  });
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));let requests=0;p.on('request',r=>{if(r.url().includes('grounds-site-map'))requests++});
  for(const width of [393,1440]) {
   await p.setViewportSize({width,height:900});await p.goto(origin+'/map');
   await p.waitForFunction(()=>document.querySelector('img[src*="grounds-site-map"]')?.complete&&!document.querySelector('[data-testid="map-artwork-grounds-loading"]'));
   await p.evaluate(()=>window.originalGrounds=document.querySelector('img[src*="grounds-site-map"]'));
   const img=p.locator('img[src*="grounds-site-map"]'),box=await img.boundingBox();await p.mouse.move(box.x+box.width*.6,box.y+box.height*.5);await p.mouse.wheel(0,-400);await p.waitForTimeout(350);
   const camera=await img.evaluate(e=>e.closest('[style*="transform:"]').style.transform),before=requests;
   for(const view of ['general','parking','general']) {
    await p.getByTestId('grounds-view-'+view).click();
    assert.deepEqual(await p.getByTestId('grounds-view-selector').getByRole('tab').allTextContents(),['General','Parking']);
    assert.equal(await p.getByTestId('grounds-traffic-notice').count(),1);
    assert.equal(await p.getByTestId('grounds-traffic-notice').textContent(),'Durham Road is barricaded at Huron Tractor to control traffic arriving from the east.');
    assert.equal(await p.locator('[data-testid^="TRAFFIC-"]').count(),view==='general'?3:0);
    assert.equal(await p.getByTestId('grounds-flow-caption').count(),view==='general'?1:0);
    assert.equal(await p.locator('[data-testid^="grounds-parking-"][role="button"]').count(),view==='parking'?15:0);
    for(const id of ['grounds-walkerton','grounds-road-Durham-Rd','grounds-road-Greenock-Brant','grounds-road-Bruce-Road-3','grounds-road-Highway-9'])assert.equal(await p.getByTestId(id).count(),1);
    assert.equal(await p.evaluate(()=>window.originalGrounds===document.querySelector('img[src*="grounds-site-map"]')&&window.originalGrounds.complete),true);
    assert.equal(await img.evaluate(e=>e.closest('[style*="transform:"]').style.transform),camera);assert.equal(requests,before);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   }
   await p.getByTestId('grounds-fit-reset').click();await p.waitForTimeout(350);await p.getByTestId('grounds-view-parking').click();
   for(const [id,label] of [['3','#3 · Bus Parking'],['accessible','Accessible Parking']]){await p.getByTestId('grounds-parking-'+id).click();await p.getByTestId('grounds-parking-info').getByText(label,{exact:true}).waitFor();await p.getByLabel('Close parking information').click();}
  }
  await p.goto(origin+'/schedule');await p.getByPlaceholder('Search schedule').waitFor();
  const intro=p.getByRole('button',{name:'Got it, close Plan your day introduction'});if(await intro.count())await intro.click();
  await p.getByText('Sunday',{exact:true}).first().waitFor({timeout:60000});
  const days=await p.getByText('Sunday',{exact:true}).first().evaluate(e=>e.parentElement.parentElement.textContent);const weekdays=days.match(/Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday/g);
  assert.deepEqual(weekdays,['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']);
  await p.goto(origin+'/vendors');await p.getByText('224 vendors',{exact:true}).waitFor({timeout:60000});
  assert.deepEqual(errors,[]);console.log('PASS staging two layers, shared barricade, no remount/download, camera, Parking labels, Sunday-first Schedule, 224 vendors, no runtime errors');
 } finally {await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
