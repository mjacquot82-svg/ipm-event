// Isolated attendee state; fixtures only in the browser, no provider calls or writes.
import assert from 'node:assert/strict';
import { assertNoClickCue } from './tutorial-click-cue-assertions.mjs';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.IPM_TEST_URL||'http://127.0.0.1:8870';
const out=process.env.IPM_TEST_OUTPUT||'.artifacts/first-visit/browser';fs.mkdirSync(out,{recursive:true});
const schedule=JSON.parse(fs.readFileSync(new URL('./fixtures/map-education-schedule.json',import.meta.url)));
const catalog=JSON.parse(fs.readFileSync(new URL('../public/api/vendors.json',import.meta.url)));
const vendor=catalog.vendors.find(v=>v.name==='Ontario Government');
const keys=['@ipm_schedule_itinerary_onboarding_v1','@ipm_vendor_find_on_map_tip_seen_v1','@ipm_maps_tour_seen_v1'];
async function fixtureRoutes(c) { await c.route('**/*',r=>{const q=r.request(),u=q.url();if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':q.headers()['access-control-request-headers']||'content-type'}});if(q.method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(u))return r.abort();if(u.endsWith('/api/schedule'))return r.fulfill({json:schedule,headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true'}});if(u.endsWith('/api/vendors'))return r.fulfill({json:{...catalog,vendors:[vendor]}});if(/onrender/.test(u))return r.abort();return r.continue();}); }
const browser=await chromium.launch();let p;
try {for(const width of (process.env.IPM_TEST_WIDTHS ? JSON.parse(process.env.IPM_TEST_WIDTHS) : [320,768,1440])) {
 const c=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'});
 await fixtureRoutes(c);
 p=await c.newPage();const tip=p.getByTestId('map-education-card');
 const flags=()=>p.evaluate(ks=>ks.map(k=>localStorage.getItem(k)),keys);
 const help=section=>p.getByRole('button',{name:section==='map'?'Map Help, replay Maps tour':section==='schedule'?'Schedule Help':'Vendors Help',exact:true});
 const visibleHelp=async(section)=>{await help(section).waitFor();const b=await help(section).boundingBox();assert(b.x>=0&&b.x+b.width<=width&&b.width>60&&b.height>=44,'Help must fit the viewport');};
 const noAutomatic=async()=>{await p.waitForTimeout(1100);assert.equal(await tip.count(),0);assert.equal(await p.getByText('Plan your day',{exact:true}).count(),0);};
 // No flags seeded: complete the fuller historical Schedule sequence.
 await p.goto(base+'/schedule');await p.getByText('Plan your day',{exact:true}).waitFor();await p.waitForTimeout(450);await p.screenshot({path:`${out}/${width}-schedule-auto.png`});assert.deepEqual(await flags(),[null,null,null]);
 await p.getByRole('button',{name:'Got it, close Plan your day introduction'}).click();await p.getByText(schedule.events[0].title,{exact:true}).first().scrollIntoViewIfNeeded();await tip.getByText('Tap an event',{exact:true}).waitFor();await p.getByTestId('schedule-education-open-event').click();await p.getByTestId('schedule-find-on-map').scrollIntoViewIfNeeded();await tip.getByText('View event details',{exact:true}).waitFor();await p.getByTestId('schedule-education-open-map').click();await p.getByTestId('map-selection-title').waitFor();
 await p.goto(base+'/schedule');await visibleHelp('schedule');await noAutomatic();await help('schedule').click();await p.getByText('Plan your day',{exact:true}).waitFor();await p.getByRole('button',{name:'Skip tutorial'}).click();await noAutomatic();assert.deepEqual(await flags(),['true',null,null]);
 // Schedule completion must not suppress Vendor automatic entry.
 await p.goto(base+'/vendors');await tip.getByText('Find this vendor',{exact:true}).waitFor();await assertNoClickCue(p);assert.match(await tip.innerText(),/Browse or search/);await p.screenshot({path:`${out}/${width}-vendors-auto.png`});await tip.getByRole('button',{name:'Got it',exact:true}).click();await p.getByTestId('vendor-find-on-map').scrollIntoViewIfNeeded();await tip.getByText('Find this vendor',{exact:true}).waitFor();await assertNoClickCue(p);assert.match(await tip.innerText(),/Tap here to jump/);await tip.getByRole('button',{name:'Got it',exact:true}).click();
 await p.goto(base+'/vendors');await visibleHelp('vendors');await noAutomatic();await help('vendors').click();await tip.getByText('Find this vendor',{exact:true}).waitFor();await tip.getByRole('button',{name:'Skip tutorial',exact:true}).click();await noAutomatic();assert.deepEqual(await flags(),['true','true',null]);
 // Other section completion must not suppress Maps automatic entry.
 await p.goto(base+'/map');for(let i=0;i<5;i++){await tip.getByText(`${i+1} of 5`,{exact:true}).waitFor();await assertNoClickCue(p);if(i===0){assert.match(await tip.innerText(),/Grounds shows the overall site.*Entrances \/ Parking/s);await p.screenshot({path:`${out}/${width}-maps-auto.png`});}if(i===2)assert.match(await tip.innerText(),/Tuesday or Wednesday–Saturday/);await tip.getByRole('button',{name:i===4?'Got it':'Next',exact:true}).click();}
 await p.goto(base+'/map');await visibleHelp('map');await noAutomatic();await help('map').click();await tip.getByText('1 of 5',{exact:true}).waitFor();await tip.getByRole('button',{name:'Skip tutorial'}).click();await noAutomatic();assert.deepEqual(await flags(),['true','true','true']);
 // Staging preview ignores only tutorial completion; unrelated state is untouched.
 await p.evaluate(()=>localStorage.setItem('walkthrough-unrelated-state-proof','keep-me'));
 for(const section of ['schedule','vendors','map']){
  await p.goto(base+'/'+section+'?previewWalkthrough=1');
  if(section==='schedule'){await p.getByText('Plan your day',{exact:true}).waitFor();await p.getByRole('button',{name:'Skip tutorial'}).click();}
  else{await tip.waitFor();await tip.getByRole('button',{name:'Skip tutorial',exact:true}).click();}
  await p.goto(base+'/'+section);await visibleHelp(section);await noAutomatic();
 }
 assert.deepEqual(await flags(),['true','true','true']);assert.equal(await p.evaluate(()=>localStorage.getItem('walkthrough-unrelated-state-proof')),'keep-me');
 console.log(`PASS ${width}: automatic Schedule → Vendors → Maps, independent completion, no repeat, visible replay, section-only staging previews`);await c.close();
}
// First-visit skip must suppress every remaining step, including historical independent tips.
const c=await browser.newContext({viewport:{width:390,height:950},serviceWorkers:'block'});
await fixtureRoutes(c);
p=await c.newPage();
for(const section of ['schedule','vendors','map']){
 await p.goto(base+'/'+section);const skip='Skip tutorial';await p.getByRole('button',{name:skip,exact:true}).waitFor();if(section==='vendors')await p.keyboard.press('Escape');else await p.getByRole('button',{name:skip,exact:true}).click();await p.goto(base+'/'+section);await p.waitForTimeout(1500);assert.equal(await p.getByTestId('map-education-card').count(),0);assert.equal(await p.getByText('Plan your day',{exact:true}).count(),0);
}
console.log('PASS fresh skip in each section suppresses automatic repeat');await c.close();
} catch(e){if(p){await p.screenshot({path:out+'/failure.png'});console.error((await p.locator('body').innerText()).slice(0,2000));}throw e;}finally{await browser.close();}
