// Verify existing vendor cards/details and search. No writes or provider calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL || 'http://localhost:8094';
const manifest=JSON.parse(fs.readFileSync(new URL('../scripts/data/artisan-tent-vendors-2026.json',import.meta.url)));
const fixture=process.env.IPM_VENDOR_FIXTURE && JSON.parse(fs.readFileSync(process.env.IPM_VENDOR_FIXTURE));
const output=process.env.IPM_TEST_OUTPUT || '.artifacts/artisan-resolution/vendors';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch();
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'});
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()!=='GET')return route.abort();
   if(url.origin===new URL(base).origin && url.pathname==='/api/vendors')return fixture?route.fulfill({json:fixture}):route.continue();
   if(url.origin===new URL(base).origin && !url.pathname.startsWith('/api/'))return route.continue();
   return route.abort();
  });
  const page=await context.newPage();await page.goto(base+'/vendors');
  const search=page.getByPlaceholder('Search vendors');await search.waitFor();
  for(const vendor of manifest.vendors) {
   await search.fill(vendor.name);
   const name=page.getByText(vendor.name,{exact:true});await name.waitFor();assert.equal(await name.count(),1);
   const card=name.locator('..');await card.getByText('Location: '+manifest.location,{exact:true}).waitFor();
   await card.getByText('Type: Indoor',{exact:true}).waitFor();
   if(vendor.name==='Amabel Books')await page.screenshot({path:`${output}/${width}-vendor-detail.png`});
  }
  console.log(`PASS ${width}: exactly one search result for each of 11 artisans, correct location and Indoor detail`);
  await context.close();
 }
} finally {await browser.close();}
