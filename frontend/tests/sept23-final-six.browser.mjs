import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL;
assert.ok(base && /ipm-web-staging\.netlify\.app|staging\.theipm\.ca/.test(new URL(base).hostname));
const out=process.env.IPM_TEST_OUTPUT || '.artifacts/six/browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']});
try{for(const width of [320,390]){
 const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,serviceWorkers:'block'});
 await context.addInitScript(()=>{for(const key of ['@ipm_vendor_find_on_map_tip_seen_v1','@ipm_maps_tour_seen_v1'])localStorage.setItem(key,'true');});
 await context.route('**/*',r=>!['GET','OPTIONS'].includes(r.request().method())||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
 const page=await context.newPage();await page.goto(base+'/vendors');await page.getByText('303 vendors',{exact:true}).waitFor({timeout:60000});
 for(const name of ["Gilligan",'Brightshores','Real Time Fun','RONA Doidge Kincardine','WASTE MANAGEMNT']){
  await page.getByPlaceholder('Search vendors').fill(name);await page.getByText('0 of 303 vendors',{exact:true}).waitFor();assert.equal(await page.getByTestId('vendor-find-on-map').count(),0);console.log('PASS',width,'removed search',name);
 }
 for(const [name,location] of [['Bellario Café','4B 10'],['Doc MacCheesey','2A 37'],['MJ Burnt Creations, Mike’s Diecast, Hill Top Farm','4B 29'],['Pronano Solutions','2A 36']]){
  await page.getByPlaceholder('Search vendors').fill(name);await page.getByText(name,{exact:true}).waitFor();await page.getByText('1 of 303 vendors',{exact:true}).waitFor();assert.ok((await page.locator('body').innerText()).includes(location));
  await page.getByTestId('vendor-find-on-map').click();await page.waitForURL(/\/map\?/);await page.getByTestId('map-selection-title').waitFor();assert.equal(await page.getByTestId('map-selection-title').innerText(),name);
  await page.locator('[data-testid=vendor-booth-highlight], [data-testid=selected-parent-range-fill], [data-testid=selected-booth-highlight]').first().waitFor();
  await page.screenshot({path:out+'/'+width+'-'+location.replaceAll(' ','-')+'.png'});console.log('PASS',width,name,location,'Find on Map + highlight');
  await page.goto(base+'/vendors');await page.getByPlaceholder('Search vendors').waitFor();
 }
 await context.close();
}}finally{await browser.close();}
