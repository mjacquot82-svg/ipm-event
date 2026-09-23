import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL;
assert.ok(base && /ipm-web-staging\.netlify\.app|staging\.theipm\.ca/.test(new URL(base).hostname));
const out=process.env.IPM_TEST_OUTPUT || new URL('../../.artifacts/four/browser',import.meta.url).pathname;
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
 await context.addInitScript(()=>{for(const key of ['@ipm_vendor_find_on_map_tip_seen_v1','@ipm_maps_tour_seen_v1'])localStorage.setItem(key,'true');});
 await context.route('**/*',r=>!['GET','OPTIONS'].includes(r.request().method())||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
 const page=await context.newPage();await page.goto(base+'/vendors');await page.getByText('304 vendors',{exact:true}).waitFor({timeout:60000});
 for(const [name,location,mapped] of [['iLGi Canada','1A 05',true],["Chris's Barbeque and Country Style Catering",'5A 23-24',true],['Diesel Creek Supply Co','4A 24',true],['Ecoflo - Septic Solutions','2A 28',true]]){
  await page.getByPlaceholder('Search vendors').fill(name);await page.getByText(name,{exact:true}).waitFor();await page.getByText('1 of 304 vendors',{exact:true}).waitFor();assert.ok((await page.locator('body').innerText()).includes(location));
  if(mapped){await page.getByTestId('vendor-find-on-map').click();await page.waitForURL(/\/map\?/);await page.getByTestId('map-selection-title').waitFor();assert.ok((await page.getByTestId('map-selection-title').innerText()).includes(name));await page.locator('[data-testid=vendor-booth-highlight], [data-testid=selected-parent-range-fill], [data-testid=selected-booth-highlight]').first().waitFor();}
  else {assert.equal(await page.getByTestId('vendor-find-on-map').count(),0);await page.getByText("Exact map location isn't available yet.",{exact:true}).waitFor();}
  console.log('PASS',name,location,mapped?'mapped':'correctly unavailable');
  await page.goto(base+'/vendors');await page.getByPlaceholder('Search vendors').waitFor();
 }
 await context.close();
}finally{await browser.close();}
