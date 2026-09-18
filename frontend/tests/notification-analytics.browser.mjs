// Authenticated organizer fixtures only. No API mutation or provider request can leave the browser.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ANALYTICS_UI_URL || 'http://localhost:8094';
const artifacts = process.env.ANALYTICS_ARTIFACTS || '/tmp/ipm-analytics-validation/.artifacts';
await mkdir(artifacts,{recursive:true});
const stats=JSON.parse(await readFile(new URL('./fixtures/notification-analytics.json',import.meta.url)));
const historyId='00000000-0000-4000-8000-000000000002';
const announcement=(id,title)=>({id,title,message:'Non-sending analytics fixture',status:'published',priority:'Information',created_by:'Fixture',created_at:'2026-09-18T22:00:00Z',expires_at:null,image:null});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const page=await context.newPage();
const errors=[];const mutations=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.pathname.startsWith('/api/')) {
  if(req.method()!=='GET') {mutations.push(url.pathname);return route.abort();}
  let body;
  if(url.pathname.endsWith('/auth/me')) body={user:{id:'fixture',username:'fixture',display_name:'Fixture Owner',role:'Owner',event_id:'ipm-2026',is_active:true}};
  else if(url.pathname.endsWith('/announcements/delivery-stats')) body={deliveries:[stats,{announcement_id:historyId,status:'sent',provider_accepted:true,provider_sent_count:null}]};
  else if(url.pathname.endsWith('/announcements')) body={announcements:[announcement(stats.announcement_id,'Provider statistics fixture'),announcement(historyId,'Celebration of Excellence Banquet')],total_count:2};
  else if(url.pathname.endsWith('/analytics/reminders')) body={active_interests:7,due_reminders:2,normal_claims:4,provider_attempts:3,provider_accepted:2,provider_failed:1,delivery_unknown:1,duplicates_suppressed:null,removed_interests:1,stale_interests:2};
  else if(url.pathname.includes('/analytics/')) return route.fulfill({status:503,json:{detail:'Unrelated fixture report unavailable'}});
  else body={announcements:[],vendors:[],events:[],users:[],broadcasts:[],total_count:0};
  return route.fulfill({json:body});
 }
 if(url.origin===new URL(base).origin) return route.continue();
 return route.abort();
});
try {
 await page.goto(base+'/admin/',{waitUntil:'domcontentloaded'});
 await page.getByText('Announcements',{exact:true}).first().click();
 await page.getByText('Provider statistics fixture',{exact:true}).waitFor();
 for (const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});
  const boxes=page.getByLabel('Announcement notification analytics');
  assert.equal(await boxes.count(),2);
  const known=await boxes.nth(0).innerText(),historical=await boxes.nth(1).innerText();
  for(const text of ['Targeted devices: 12','Sent to push service: 11','Provider-confirmed receipts: 9','Notification opens: 3','Provider failures: 1','Notification-origin app visits: 2','Provider accepted: Yes']) assert.ok(known.includes(text),text);
  for(const text of ['Targeted devices: Not available','Sent to push service: Not available','Provider-confirmed receipts: Not available','Notification-origin app visits: Not available']) assert.ok(historical.includes(text),text);
  assert.doesNotMatch(known+historical,/Delivered:|capability|push.token|00000000-|ipm-everyone-/i);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:artifacts+`/notification-analytics-${width}.png`,fullPage:true});
  console.log(`PASS authenticated organizer fixture and historical nulls ${width}px`);
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.getByText('Analytics',{exact:true}).first().click();
 const reminders=page.getByLabel('T-30 reminder analytics');
 await reminders.getByText('Active reminder interests: 7',{exact:true}).waitFor();
 assert.ok((await reminders.innerText()).includes('Duplicate attempts suppressed: Not available'));
 assert.doesNotMatch(await reminders.innerText(),/installation_id|capability_hash|push_token/);
 await reminders.screenshot({path:artifacts+'/t30-analytics.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
 console.log('PASS T-30 aggregate presentation; zero provider requests and zero API mutations');
} finally {await browser.close();}
