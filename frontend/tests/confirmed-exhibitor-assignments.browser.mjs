// Real published/built catalog; all mutations and notification-provider requests blocked.
import assert from 'node:assert/strict';import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL || 'http://127.0.0.1:8891';const out=process.env.IPM_TEST_OUTPUT || '.artifacts/confirmed-exhibitors';fs.mkdirSync(out,{recursive:true});
const cases=[['Fellowship','Fellowship of Christian Farmers','2A-16–17'],['Mitchell Cycle','Mitchell Cycle Inc., Mitchell','2A-18–19'],['Bailey Repair','Bailey Repair Services Ltd., Palmerston','2A-20'],['B Town Farm Supply','B Town Farm Supply','1B-07'],['JW Custom Fab','JW Custom Fab, Cargill','5A-21']];
const browser=await chromium.launch();const c=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const errors=[];
await c.addInitScript(()=>{for(const key of ['@ipm_vendor_find_on_map_tip_seen_v1','@ipm_maps_tour_seen_v1'])localStorage.setItem(key,'true');});
await c.route('**/*',r=>!['GET','HEAD','OPTIONS'].includes(r.request().method())||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));const results=[];
try{
 for(const [search,name,location] of cases){
  await p.goto(base+'/vendors',{waitUntil:'domcontentloaded'});await p.getByPlaceholder('Search vendors',{exact:true}).fill(search);
  await p.getByText(name,{exact:true}).first().waitFor();await p.getByTestId('vendor-find-on-map').waitFor();
  assert.equal(await p.getByTestId('vendor-find-on-map').count(),1);
  assert((await p.locator('body').innerText()).includes(location),'directory location '+name);
  await p.screenshot({path:out+'/'+search.replaceAll(' ','-')+'-directory.png'});
  await p.getByTestId('vendor-find-on-map').click();await p.waitForURL(/\/map\?/);
  await p.waitForFunction(name=>document.querySelector('[data-testid="map-selection-title"]')?.textContent===name,name);
  const u=new URL(p.url());assert.equal(u.searchParams.get('mapType'),'tented');assert.equal(u.searchParams.get('vendorLocation'),location);
  await p.locator('[data-testid=vendor-booth-highlight], [data-testid=selected-booth-highlight]').first().waitFor();const card=await p.getByTestId('map-selection-card').innerText();assert(card.includes(location),'map location '+name);
  if(search==='JW Custom Fab')assert(!card.includes('2A-16'));
  await p.screenshot({path:out+'/'+search.replaceAll(' ','-')+'-map.png'});
  results.push({name,location,highlight:true});console.log('PASS',name,location,'directory/search + real Find on Map + highlight');
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
