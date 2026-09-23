import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL;
assert.ok(base && /ipm-web-staging\.netlify\.app|staging\.theipm\.ca/.test(new URL(base).hostname));
const out=process.env.IPM_TEST_OUTPUT || new URL('../../.artifacts/decisions/browser',import.meta.url).pathname;
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
 await context.addInitScript(()=>{for(const key of ['@ipm_vendor_find_on_map_tip_seen_v1','@ipm_maps_tour_seen_v1'])localStorage.setItem(key,'true');});
 await context.route('**/*',r=>!['GET','OPTIONS'].includes(r.request().method())||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
 const page=await context.newPage();await page.goto(base+'/vendors');await page.getByText('306 vendors',{exact:true}).waitFor({timeout:60000});
 for(const [name,location,mapped] of [['K and S Boat and Sled','4B 34',true],['Kreations Candy and Treats, Hanover','4B-34',true],['Fruitage of the Field','4B 24',true],['Old Country Leather, Chesley','4B-24',true],['Northern Fabrication','4A 14',true],['Hip Town Hype, Trent Lakes','4A-14',true],['Dodge RAM','5A 01-04',false],['ENJO Canada','4A 16-21',true],['Treemendous Tree Sales & Transplanting','5A 32',true],["Women's House Serving Bruce and Grey",'4B 06',true]]){
  await page.getByPlaceholder('Search vendors').fill(name);await page.getByText(name,{exact:true}).waitFor();await page.getByText('1 of 306 vendors',{exact:true}).waitFor();assert.ok((await page.locator('body').innerText()).includes(location));
  if(mapped){await page.getByTestId('vendor-find-on-map').click();await page.waitForURL(/\/map\?/);await page.getByTestId('map-selection-title').waitFor();assert.ok((await page.getByTestId('map-selection-title').innerText()).includes(name));await page.locator('[data-testid=vendor-booth-highlight], [data-testid=selected-parent-range-fill], [data-testid=selected-booth-highlight]').first().waitFor();}
  else {assert.equal(await page.getByTestId('vendor-find-on-map').count(),0);await page.getByText("Exact map location isn't available yet.",{exact:true}).waitFor();}
  console.log('PASS',name,location,mapped?'mapped':'correctly unavailable');
  await page.goto(base+'/vendors');await page.getByPlaceholder('Search vendors').waitFor();
 }
 await page.getByPlaceholder('Search vendors').fill('Partnership Park');await page.getByText('No Matching Vendors',{exact:true}).waitFor();
 await page.screenshot({path:out+'/partnership-not-vendor.png'});console.log('PASS Partnership Park excluded from vendor catalog');
 await context.close();
}finally{await browser.close();}
