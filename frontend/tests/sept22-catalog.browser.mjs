import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const expectedCount=JSON.parse(fs.readFileSync(new URL('../public/api/vendors.json',import.meta.url))).vendors.length;
const base=process.env.IPM_TEST_URL || 'http://127.0.0.1:8767';
assert.ok(!/^https:\/\/(www\.)?theipm\.ca/.test(base),'Never run against production');
const out=process.env.IPM_TEST_OUTPUT || new URL('../../.artifacts/sept22/browser', import.meta.url).pathname;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 for(const width of [390,320]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(()=>{
   for(const key of ['@ipm_vendor_find_on_map_tip_seen_v1','@ipm_maps_tour_seen_v1','@ipm_schedule_itinerary_onboarding_v1'])localStorage.setItem(key,'true');
  });
  await context.route('**/*',r=>!['GET','OPTIONS'].includes(r.request().method())||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
  const page=await context.newPage();const requests=[];
  page.on('request',r=>{if(/\/api\/vendors(?:\?|$)/.test(r.url()))requests.push(r.url());});
  await page.goto(base+'/vendors');await page.getByText(`${expectedCount} vendors`,{exact:true}).waitFor({timeout:60000});
  for(const [query,name,location,mapped] of [
   ['CAN-AM','Can-Am Demo Area, Montreal, QC','West 4',true],
   ['Valard','Valard Construction, Vaughan','5A 39-42',true],
   ['Hometown','Hometown Street Eats, Drayton','Lounge',true],
   ['Metcalf','Metcalf Food & Beverage Inc.','3B 13-14',true],
   ['Walkerton & District','Walkerton & District Hospital Foundation','3B 06',true],
   ['Action First Aid','Action First Aid','4A 05-10',true],
   ['Turquesa','Turquesa Mexican Food','2B 25',true],
   ['Cottrill','Cottrill Heavy Equipment, Kincardine','2A-05',true],
  ]){
   await page.getByPlaceholder('Search vendors').fill(query);await page.getByText(name,{exact:true}).waitFor();
   assert.ok((await page.locator('body').innerText()).includes(location),name+' location');
   await page.getByText(`1 of ${expectedCount} vendors`,{exact:true}).waitFor();
   if(mapped){
    await page.getByTestId('vendor-find-on-map').click();await page.waitForURL(/\/map\?/);
    await page.getByTestId('map-selection-title').waitFor();assert.ok((await page.getByTestId('map-selection-title').innerText()).toLowerCase().includes(name.toLowerCase()),name+' correct destination');await page.locator('[data-testid=vendor-booth-highlight], [data-testid=selected-parent-range-fill], [data-testid=selected-booth-highlight], [data-testid=selected-stage-highlight]').first().waitFor({timeout:20000});
    if(['CAN-AM','Action First Aid'].includes(query))await page.screenshot({path:`${out}/${width}-${query.replaceAll(' ','-')}.png`});
    await page.goto(base+'/vendors');await page.getByPlaceholder('Search vendors').waitFor();
   }
   console.log('PASS',width,name,location);
  }
  await page.getByPlaceholder('Search vendors').fill('no-such-exhibitor-xyz');await page.getByText('No Matching Vendors',{exact:true}).waitFor();
  assert.ok(requests.length);assert.ok(requests.every(u=>u===base+'/api/vendors'),JSON.stringify(requests));
  await context.close();
 }
}finally{await browser.close();}
