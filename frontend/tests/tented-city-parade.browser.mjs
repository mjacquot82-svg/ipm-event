// Run with IPM_TEST_URL and PLAYWRIGHT_MODULE. All writes/provider traffic blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL || 'http://localhost:8094';
const output=process.env.IPM_TEST_OUTPUT || '.artifacts/parade-route-review';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 for (const width of [390,768,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',hasTouch:true});
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()!=='GET')return route.abort();
   if(url.origin===new URL(base).origin && !url.pathname.startsWith('/api/'))return route.continue();
   return route.abort();
  });
  await context.addInitScript(()=>localStorage.setItem('@ipm_maps_tour_seen_v1','true'));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/map?mapType=tented`);
  const toggle=page.getByRole('button',{name:/^Parade Routes/});await toggle.waitFor();
  assert.equal(await page.locator('[data-testid^="parade-route-"]').count(),0);
  await toggle.click();
  for(const [id,label] of [['tuesday','Tuesday'],['wed-sat','Wednesday–Saturday']]) {
   await page.getByRole('radio',{name:`Parade route: ${label}`,exact:true}).click();
   const overlay=page.getByTestId(`parade-route-${id}`);await overlay.waitFor();
   assert.equal(await page.locator('[data-testid^="parade-route-"]').count(),1);
   assert.match(await page.getByRole('radio',{name:`Parade route: ${label}`,exact:true}).innerText(), /^✓ /);
   const aligned=()=>overlay.evaluate(el=>{
    const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();
    return ['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<1);
   });
   assert(await aligned());
   await page.screenshot({path:`${output}/${width}-${id}.png`});
   if(width===1440) {
    // Capture the actual layer at its fitted size; never resize independently of the base image.
    await overlay.locator('..').screenshot({path:`${output}/comparison-${id}.png`});
   }
  }
  // Search moves camera and keeps the route attached to the map with the highlight.
  const input=page.getByPlaceholder('Find a vendor, booth, stage, or place');
  await input.fill('ACE');await page.getByText('ACE / JCB, Harriston',{exact:true}).first().click();
  await page.locator('[data-testid=vendor-booth-highlight], [data-testid=selected-booth-highlight]').first().waitFor();
  assert.equal(await page.getByTestId('parade-route-wed-sat').count(),1);
  const metrics=()=>page.getByTestId('parade-route-wed-sat').evaluate(el=>{
   const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();
   return {aligned:['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<1),transform:getComputedStyle(el.parentElement).transform};
  });
  await page.waitForTimeout(600);assert((await metrics()).aligned);
  const before=(await metrics()).transform;
  await page.mouse.move(width*0.7,600);await page.mouse.wheel(0,-200);await page.waitForTimeout(500);
  await page.mouse.move(width*0.7,600);await page.mouse.down();await page.mouse.move(width*0.7-40,630,{steps:8});await page.mouse.up();
  assert((await metrics()).aligned);
  assert.notEqual((await metrics()).transform,before);
  if(width<1000) {
   const cdp=await context.newCDPSession(page);
   const cx=width*0.6, cy=550;
   const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id}))});
   await touch('touchStart',[[cx-20,cy],[cx+20,cy]]);
   await touch('touchMove',[[cx-45,cy],[cx+45,cy]]);
   await touch('touchEnd',[]);assert((await metrics()).aligned);
  }
  await page.getByLabel('Reset map zoom',{exact:true}).click();await page.waitForTimeout(500);assert((await metrics()).aligned);
  await page.getByRole('radio',{name:'Parade route: Off',exact:true}).click();
  assert.equal(await page.locator('[data-testid^="parade-route-"]').count(),0);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}: default off, exclusive switching, search/highlight, camera alignment, reset, off`);
  await context.close();
 }
} finally {await browser.close();}
