// Authenticated organizer fixtures only. No API mutation or provider request can leave the browser.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ANALYTICS_UI_URL || 'http://localhost:8094';
const artifacts = process.env.ANALYTICS_ARTIFACTS || '.artifacts/notification-analytics';
await mkdir(artifacts,{recursive:true});
const stats=JSON.parse(await readFile(new URL('./fixtures/notification-analytics.json',import.meta.url)));
const noSendId='00000000-0000-4000-8000-000000000003';
const partialId='00000000-0000-4000-8000-000000000004';
let statisticsUnavailable=false;
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
  else if(url.pathname.endsWith('/announcements/delivery-stats')) {
   if(statisticsUnavailable) return route.fulfill({status:503,json:{detail:'Unavailable'}});
   body={deliveries:[stats,{announcement_id:historyId,status:'sent',provider_accepted:true,requested_at:'2026-09-07T19:05:37Z',provider_sent_count:null},{announcement_id:partialId,status:'sent',provider_accepted:true,provider_sent_count:11,provider_open_count:0}]};
  }
  else if(url.pathname.endsWith('/announcements')) body={announcements:[announcement(stats.announcement_id,'Provider statistics fixture'),announcement(historyId,'[STAGING] WonderPush Test'),announcement(noSendId,'test2'),announcement(partialId,'Partial statistics fixture')],total_count:4};
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
 for (const width of [1440,768,390]) {
  await page.setViewportSize({width,height:1000});
  const boxes=page.getByLabel('Announcement notification analytics');
  assert.equal(await boxes.count(),4);
  const known=await boxes.nth(0).innerText(),historical=await boxes.nth(1).innerText();
  const empty=await boxes.nth(2).innerText(),partial=await boxes.nth(3).innerText();
  for(const text of ['Targeted devices: 12','Sent to push service: 11','Provider-confirmed receipts: 9','Notification opens: 3','Provider failures: 1','Notification-origin app visits: 2']) assert.equal(await boxes.nth(0).getByLabel(text,{exact:true}).count(),1,text);
  assert.ok(known.includes('Sent to WonderPush: Yes'));
  assert.ok(!known.includes('not available'));
  assert.ok(historical.includes('Sent to WonderPush: Yes'));
  assert.ok(historical.includes('Requested:'));
  assert.ok(historical.includes('Detailed delivery analytics are not available for this send.'));
  assert.ok(!historical.includes('Targeted devices'));
  assert.equal(empty,'Notification\nNo notification sent');
  assert.ok((await boxes.nth(2).boundingBox()).height<90);
  assert.ok((await boxes.nth(1).boundingBox()).height<150);
  assert.equal(await boxes.nth(3).getByLabel('Notification opens: 0',{exact:true}).count(),1);
  assert.ok(partial.includes('Additional delivery analytics are not available.'));
  assert.ok(!partial.includes('Provider-confirmed receipts'));
  assert.doesNotMatch(known+historical+empty+partial,/Delivered:|capability|push.token|00000000-|ipm-everyone-/i);
  assert.equal(await page.getByText(/Provider acceptance and receipts/).count(),0);
  const details=page.getByRole('button',{name:/Analytics details/});
  await details.click();
  await page.getByText(/Provider acceptance and receipts/).waitFor();
  assert.equal(await details.getAttribute('aria-expanded'),'true');
  assert.equal(await page.getByText(/Provider acceptance and receipts/).count(),1);
  await details.click();
  await page.getByText(/Provider acceptance and receipts/).waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:artifacts+`/notification-analytics-${width}.png`,fullPage:true});
  for (let i=0;i<4;i++) await boxes.nth(i).screenshot({path:artifacts+`/notification-case-${i}-${width}.png`});
  console.log(`PASS authenticated organizer fixture and historical nulls ${width}px`);
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.getByText('Analytics',{exact:true}).first().click();
 const reminders=page.getByLabel('T-30 reminder analytics');
 await reminders.getByLabel('Active reminder interests',{exact:true}).getByText('7',{exact:true}).waitFor();
 assert.ok(!(await reminders.innerText()).includes('Duplicate attempts'));
 assert.doesNotMatch(await reminders.innerText(),/installation_id|capability_hash|push_token/);
 await reminders.screenshot({path:artifacts+'/t30-analytics.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
 console.log('PASS T-30 aggregate presentation; zero provider requests and zero API mutations');
 statisticsUnavailable=true;
 await page.getByText('Announcements',{exact:true}).first().click();
 await page.getByText('Notification analytics temporarily unavailable',{exact:true}).first().waitFor();
 assert.equal(await page.getByText('No notification sent',{exact:true}).count(),0);
 console.log('PASS failed statistics load never claims no notification was sent');
} finally {await browser.close();}
