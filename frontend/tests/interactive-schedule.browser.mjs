// Isolated attendee state; fixtures only in the browser, no provider calls or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.IPM_TEST_URL||'http://127.0.0.1:8870';
const out=process.env.IPM_TEST_OUTPUT||'.artifacts/interactive-schedule/browser';fs.mkdirSync(out,{recursive:true});
const schedule=JSON.parse(fs.readFileSync(new URL('./fixtures/map-education-schedule.json',import.meta.url)));
const catalog=JSON.parse(fs.readFileSync(new URL('../public/api/vendors.json',import.meta.url)));
const vendor=catalog.vendors.find(v=>v.name==='Ontario Government');
const keys=['@ipm_schedule_itinerary_onboarding_v1','@ipm_vendor_find_on_map_tip_seen_v1','@ipm_maps_tour_seen_v1'];
async function fixtureRoutes(c) { await c.route('**/*',r=>{const q=r.request(),u=q.url();if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':q.headers()['access-control-request-headers']||'content-type'}});if(q.method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(u))return r.abort();if(u.endsWith('/api/schedule'))return r.fulfill({json:schedule,headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true'}});if(u.endsWith('/api/vendors'))return r.fulfill({json:{...catalog,vendors:[vendor]}});if(/onrender/.test(u))return r.abort();return r.continue();}); }
const filteredEvent={...schedule.events[0],id:'33333333-4444-4555-8666-777777777777',title:'Fixture filtered event'};schedule.events.push(filteredEvent);
const browser=await chromium.launch();let p;
try {for(const width of [320,768,1440]) {
 const c=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'});await fixtureRoutes(c);
 p=await c.newPage();const tip=p.getByTestId('map-education-card');
 async function followInteractiveFlow(label,event=schedule.events[0]) {
  await p.getByText('Plan your day',{exact:true}).waitFor();await p.getByRole('button',{name:'Got it, close Plan your day introduction'}).click();
  await p.getByText(event.title,{exact:true}).first().scrollIntoViewIfNeeded();
  await tip.getByText('View event details',{exact:true}).waitFor();
  assert.equal(await tip.getByRole('button',{name:/Got it|Next/}).count(),0);
  await p.mouse.click(2,500);await p.waitForTimeout(300);await tip.getByText('View event details',{exact:true}).waitFor();
  await p.screenshot({path:`${out}/${width}-${label}-event-target.png`});
  // Keyboard users can reach the real action as well as Skip.
  await p.getByTestId('schedule-education-open-event').focus();await p.keyboard.press('Tab');assert.equal(await p.getByRole('button',{name:'Skip walkthrough',exact:true}).evaluate(e=>e===document.activeElement),true);
  await p.getByTestId('schedule-education-open-event').click();
  await p.getByTestId('schedule-find-on-map').scrollIntoViewIfNeeded();await tip.getByText('Find this event',{exact:true}).waitFor();
  assert.match(await tip.innerText(),/time, date and location/);assert.equal(await tip.getByRole('button',{name:/Got it|Next/}).count(),0);
  await p.mouse.click(2,500);await p.waitForTimeout(300);await tip.getByText('Find this event',{exact:true}).waitFor();
  await p.screenshot({path:`${out}/${width}-${label}-location-target.png`});
  await p.getByTestId('schedule-education-open-map').click();await p.getByTestId('selected-stage-highlight').waitFor();
  assert.equal(await p.getByTestId('map-selection-title').innerText(),event.title);
  assert.doesNotMatch(await p.getByTestId('map-selection-card').innerText(),/10:00|10:15/);assert.equal(await tip.count(),0);
 }
 await p.goto(base+'/schedule');await followInteractiveFlow('fresh');
 await p.goto(base+'/schedule');await p.getByRole('button',{name:'Schedule Help',exact:true}).waitFor();await p.waitForTimeout(1000);assert.equal(await tip.count(),0);assert.equal(await p.getByText('Plan your day',{exact:true}).count(),0);
 await p.getByPlaceholder('Search schedule',{exact:true}).fill(filteredEvent.title);await p.getByRole('button',{name:'Schedule Help',exact:true}).click();await followInteractiveFlow('replay-filtered',filteredEvent);
 await p.goto(base+'/schedule');await p.getByRole('button',{name:'Schedule Help',exact:true}).click();await p.getByRole('button',{name:'Got it, close Plan your day introduction'}).click();await tip.getByText('View event details',{exact:true}).waitFor();await p.getByRole('button',{name:'Skip walkthrough',exact:true}).click();await p.waitForTimeout(900);assert.equal(await tip.count(),0);
 assert.equal(await p.evaluate(()=>localStorage.getItem('@ipm_schedule_itinerary_onboarding_v1')),'true');
 console.log(`PASS ${width}: fresh/replay interactive event and location actions; unrelated taps blocked; keyboard target/Skip reachable; correct event highlight, no times; skip and persistence`);await c.close();
}
// No current events: keep the app usable rather than inventing a tutorial target.
const c=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:'block'});await fixtureRoutes(c);schedule.events=[];
p=await c.newPage();await p.goto(base+'/schedule');await p.getByRole('button',{name:'Got it, close Plan your day introduction'}).click();await p.waitForTimeout(1000);assert.equal(await p.getByTestId('map-education-overlay').count(),0);await p.getByRole('button',{name:'Schedule Help',exact:true}).click();await p.getByRole('button',{name:'Skip Schedule walkthrough'}).click();console.log('PASS empty Schedule: no fabricated target or blocking overlay; Help and Skip usable');await c.close();
} catch(e){if(p){await p.screenshot({path:out+'/failure.png'});console.error((await p.locator('body').innerText()).slice(0,2000));}throw e;}finally{await browser.close();}
