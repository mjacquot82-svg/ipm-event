// Read-only schedule verification; all mutations/provider traffic are blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL || 'http://localhost:8094';
const expected=JSON.parse(fs.readFileSync(process.env.IPM_EXPECTED_EVENTS));
const fixture=process.env.IPM_SCHEDULE_FIXTURE && JSON.parse(fs.readFileSync(process.env.IPM_SCHEDULE_FIXTURE));
const output=process.env.IPM_TEST_OUTPUT || '.artifacts/artisan-update/browser';fs.mkdirSync(output,{recursive:true});
const b=await chromium.launch();
try {
 for(const width of [390,1440]) {
  const c=await b.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  await c.route('**/*',r=>{
   const req=r.request(),url=new URL(req.url());
   if(req.method()!=='GET')return r.abort();
   if(url.pathname==='/api/schedule')return fixture?r.fulfill({json:fixture}):r.continue();
   if(url.origin===new URL(base).origin&&!url.pathname.startsWith('/api/'))return r.continue();
   return r.abort();
  });
  await c.addInitScript(()=>{
   for(const key of ['@ipm_schedule_itinerary_onboarding_v1','@ipm_schedule_event_details_tip_seen_v1','@ipm_schedule_find_on_map_tip_seen_v1'])localStorage.setItem(key,'true');
   // An existing favorite is retained while new presentations are added.
   localStorage.setItem('@event_navigator_favorites',JSON.stringify({sessionIds:['0d13e978-8a65-401e-b4ee-c6a6feb5331b']}));
  });
  const p=await c.newPage();
  for(const event of expected) {
   await p.goto(base+'/schedule');
   await p.getByPlaceholder('Search schedule').fill(event.description.replace('Presenter: ',''));
   await p.getByText(event.days_active,{exact:true}).first().click();
   await p.getByText(event.title,{exact:true}).first().waitFor();
   await p.getByText(event.title,{exact:true}).first().click();
   const dialog=p.getByRole('dialog');await dialog.waitFor();
   await dialog.getByText(event.start_date,{exact:true}).waitFor();
   await dialog.getByText(event.start_time,{exact:true}).waitFor();
   await dialog.getByText(event.location_name,{exact:true}).waitFor();
   await dialog.getByText(event.description,{exact:true}).waitFor();
   if(event.title.startsWith('Wild Side'))await p.screenshot({path:`${output}/${width}-ken-detail.png`});
   await dialog.getByText('Add to Itinerary',{exact:true}).click();
   await p.waitForFunction(id=>JSON.parse(localStorage.getItem('@event_navigator_favorites')).sessionIds.includes(id),event.id);
   assert((await p.evaluate(()=>JSON.parse(localStorage.getItem('@event_navigator_favorites')).sessionIds)).includes('0d13e978-8a65-401e-b4ee-c6a6feb5331b'));
  }
  console.log(`PASS ${width}: all eight presenters searchable, day-filtered, exact details, stable favorites; existing favorite preserved`);
  await c.close();
 }
} finally {await b.close();}
