// Actual built/deployed app, staging fixtures only. No provider traffic or API writes.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.ANALYTICS_UI_URL || 'http://localhost:8094';
const artifacts=process.env.ANALYTICS_ARTIFACTS || '.artifacts/notification-health';
const cases=JSON.parse(await readFile(new URL('./fixtures/notification-overview.json',import.meta.url)));
await mkdir(artifacts,{recursive:true});
const health=JSON.parse(await readFile(new URL('./fixtures/notification-health.json',import.meta.url)));
let current='empty',unavailable=false,role='Communications',healthCase='healthy',diagnosticCalls=0,healthUnavailable=false;
const errors=[],mutations=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.pathname.startsWith('/api/')){
  if(req.method()!=='GET'){mutations.push(url.pathname);return route.abort();}
  let body={};
  if(url.pathname.endsWith('/auth/me'))body={user:{id:'fixture',username:'fixture',display_name:'STAGING FIXTURE',role,event_id:'ipm-2026',is_active:true}};
  else if(url.pathname.endsWith('/notification-summary')){
   if(unavailable)return route.fulfill({status:503,json:{detail:'Summary unavailable'}});
   body=cases[current];
  }
  else if(url.pathname.endsWith('/analytics/reminders'))body={active_interests:7,provider_accepted:3,provider_failed:1,delivery_unknown:2};
  else if(url.pathname.endsWith('/analytics/summary'))body={collectionStartedAt:null,overview:{uniqueVisitors:1,newVisitors:1,returningVisitors:0,sessions:1,launches:1,pageViews:1,installedPwaVisitors:0,browserOnlyVisitors:1,averageSessionDurationSeconds:null,sessionDurationSampleSize:0}};
  else if(url.pathname.endsWith('/analytics/live'))body={live:{activeSessions:0,activityLastMinute:0,activityLastFiveMinutes:0,mostRecentActivityAt:null,activityWindowMinutes:30,topActivePages:[]}};
  else if(url.pathname.endsWith('/analytics/traffic'))body={traffic:{todayByHour:[],byDay:[]}};
  else if(url.pathname.endsWith('/analytics/content'))body={content:{pages:[],vendors:{filters:[]},map:{sources:[],locations:[]},schedule:{filters:[],mostOpenedEvents:[]},announcements:{openSources:[],ranking:[]},queenOfTheFurrow:{},quickActions:{actions:[],destinationTypes:[],sources:[]},outboundLinks:{destinations:[],destinationTypes:[]},featureAdoption:[],eventDayComparisons:[]}};
  else if(url.pathname.endsWith('/notification-health')) {
   if(url.searchParams.get('view')==='summary') {
    if(healthUnavailable)return route.fulfill({status:503,json:{detail:'Health unavailable'}});
    body=health[healthCase].summary;
   } else {
    diagnosticCalls++;
    assert.equal(role,'Owner','Non-owner must never request diagnostics');
    body=health[healthCase].diagnostics;
   }
  }
  else body={announcements:[],deliveries:[],vendors:[],events:[],total_count:0};
  return route.fulfill({json:body});
 }
 if(url.origin===new URL(base).origin)return route.continue();
 return route.abort();
});
async function openAnalytics(width){
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/admin/',{waitUntil:'domcontentloaded'});
 await page.getByText('Analytics',{exact:true}).first().click();
 await page.getByLabel('Notification health summary').getByText(health[healthCase].summary.message,{exact:true}).waitFor();
 await page.setViewportSize({width,height:1000});
}
const technicalLabels={
 'Notification registrations':'registrations','Checked':'checked','Verified':'verified','Repairable mismatch':'repairable_mismatch',
 'Key mismatch':'key_mismatch','Other ineligible':'other_ineligible','Not yet checked':'not_yet_checked','Other checked states':'other_checked',
 'Provider-ready at last check':'provider_ready','Current check failures':'current_check_failures','Uncertain outcomes':'uncertain',
 'Active operations':'active_leases','Expired leases':'expired_leases','Retries due':'retries_due','Retries scheduled':'retries_scheduled',
};
try{
 for(const width of [1440,768,390]){
  role='Communications';healthCase='healthy';diagnosticCalls=0;
  await openAnalytics(width);
  const summary=page.getByLabel('Notification health summary');
  assert.ok((await summary.innerText()).includes('3 devices ready at last check'));
  assert.ok((await summary.boundingBox()).height<200);
  assert.equal(await page.getByText('Advanced notification diagnostics',{exact:true}).count(),0);
  for(const label of Object.keys(technicalLabels)) assert.equal(await page.getByText(label,{exact:true}).count(),0,label);
  await page.getByText('No announcement notifications accepted by the provider yet.',{exact:true}).waitFor();
  assert.equal(await page.getByText('Event reminders / T-30',{exact:true}).count(),1);
  assert.equal(await page.getByLabel('Reminders provider accepted',{exact:true}).getByText('3',{exact:true}).count(),1);
  assert.equal(diagnosticCalls,0);
  await summary.screenshot({path:`${artifacts}/organizer-health-${width}.png`});
  role='Owner';healthCase='attention';
  await openAnalytics(width);
  const toggle=page.getByRole('button',{name:/^Advanced notification diagnostics/});
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.equal(await page.getByText('Notification registrations',{exact:true}).count(),0);
  assert.equal(diagnosticCalls,0);
  await toggle.click();
  const panel=page.getByLabel('Advanced notification diagnostic values');
  await panel.getByText('Notification registrations',{exact:true}).waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  for(const [label,key] of Object.entries(technicalLabels)){
   const card=panel.getByText(label,{exact:true}).locator('..');
   assert.equal(await card.getByText(String(health.attention.diagnostics[key]),{exact:true}).count(),1,label);
  }
  for(const label of ['Repairs attempted','Repairs verified','Repair failures']) assert.equal(await panel.getByText(label,{exact:true}).locator('..').getByText('Not recorded',{exact:true}).count(),1);
  assert.equal(await panel.getByText('Open — checks paused',{exact:true}).count(),1);
  assert.doesNotMatch(await panel.innerText(),/push_token|capability_hash|installation_id|provider_campaign_id/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width,height:5000});
  await panel.screenshot({path:`${artifacts}/owner-diagnostics-${width}.png`});
  await page.setViewportSize({width,height:1000});
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/notification-health')),panel.getByRole('button',{name:'Refresh diagnostics',exact:true}).click()]);
  assert.equal(diagnosticCalls,2);
  await toggle.click();
  await panel.waitFor({state:'hidden'});
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  console.log(`PASS compact organizer, Owner-only collapsed diagnostics, preserved values ${width}px`);
 }
 role='Communications';
 for(healthCase of ['unchecked','stale','empty']){
  await openAnalytics(390);
  const text=await page.getByLabel('Notification health summary').innerText();
  assert.ok(text.includes(health[healthCase].summary.message));
  assert.ok(!text.includes('No known notification problems'));
 }
 healthUnavailable=true;
 await page.getByText('Refresh',{exact:true}).first().click();
 await page.getByText('Notification health is temporarily unavailable.',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
 console.log('PASS unknown/stale/empty/error summaries; no provider calls or API mutations');
}finally{await browser.close();}
