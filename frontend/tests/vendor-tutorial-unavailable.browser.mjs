// Browser-only catalog edge cases. No server writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertClickCue, assertNoClickCue } from './tutorial-click-cue-assertions.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL || 'http://127.0.0.1:8870';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/api/vendors.json',import.meta.url)));
const browser=await chromium.launch();
try {for(const mapped of [false,true]) {
 const context=await browser.newContext({viewport:{width:320,height:568},serviceWorkers:'block'});
 await context.route('**/*',route=>{
  const request=route.request(),url=request.url();
  if(!['GET','OPTIONS'].includes(request.method())||/wonderpush|webpushr|google-analytics/.test(url))return route.abort();
  if(/\/api\/vendors(?:\.json)?(?:\?|$)/.test(url))return route.fulfill({json:{...catalog,vendors:catalog.vendors.filter(v=>v.name==='CAN-AM'||mapped&&v.name==='Ontario Government')},headers:{'access-control-allow-origin':'*'}});
  return route.continue();
 });
 await context.addInitScript(()=>localStorage.setItem('@ipm_vendor_find_on_map_tip_seen_v1','true'));
 const page=await context.newPage();await page.goto(base+'/vendors');
 await page.getByPlaceholder('Search vendors').fill('CAN-AM');
 await page.getByRole('button',{name:'Vendors Help',exact:true}).click();
 const tip=page.getByTestId('map-education-card');
 if(mapped){await tip.getByText('Find this vendor',{exact:true}).waitFor();assert.match(await tip.innerText(),/Showing a mapped vendor from all vendors/);await assertClickCue(page,'vendor-education-open-map');assert.equal(await page.getByPlaceholder('Search vendors').inputValue(),'');}
 else {await tip.getByText('Vendor locations unavailable',{exact:true}).waitFor();assert.match(await tip.innerText(),/No mapped vendor locations/);await assertNoClickCue(page);}
 await tip.getByRole('button',{name:'Skip tutorial',exact:true}).click();await tip.waitFor({state:'hidden'});await assertNoClickCue(page);
 console.log(`PASS ${mapped?'unmapped filtered vendor recovers to mapped target':'no mapped vendors gives explicit guidance and Skip'}`);
 await context.close();
}}finally{await browser.close();}
