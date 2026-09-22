// Actual built/deployed app, staging fixtures only. No provider traffic or API writes.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.ANALYTICS_UI_URL || 'http://localhost:8094';
const artifacts=process.env.ANALYTICS_ARTIFACTS || '.artifacts/notification-overview';
const cases=JSON.parse(await readFile(new URL('./fixtures/notification-overview.json',import.meta.url)));
await mkdir(artifacts,{recursive:true});
let current='empty',unavailable=false;
const errors=[],mutations=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.pathname.startsWith('/api/')){
  if(req.method()!=='GET'){mutations.push(url.pathname);return route.abort();}
  let body={};
  if(url.pathname.endsWith('/auth/me'))body={user:{id:'fixture',username:'fixture',display_name:'STAGING FIXTURE',role:'Owner',event_id:'ipm-2026',is_active:true}};
  else if(url.pathname.endsWith('/notification-summary')){
   if(unavailable)return route.fulfill({status:503,json:{detail:'Summary unavailable'}});
   body={...cases[current]};
   // The older fixture predates the summary coverage fields asserted below.
   if(current==='historical')Object.assign(body,{detailed_sends:0,historical_unattributed_sends:2});
  }
  else if(url.pathname.endsWith('/analytics/reminders'))body={active_interests:7,provider_accepted:3,provider_failed:1,delivery_unknown:2};
  else if(url.pathname.endsWith('/analytics/summary'))body={collectionStartedAt:null,overview:{uniqueVisitors:1,newVisitors:1,returningVisitors:0,sessions:1,launches:1,pageViews:1,installedPwaVisitors:0,browserOnlyVisitors:1,averageSessionDurationSeconds:null,sessionDurationSampleSize:0}};
  else if(url.pathname.endsWith('/analytics/live'))body={live:{activeSessions:0,activityLastMinute:0,activityLastFiveMinutes:0,mostRecentActivityAt:null,activityWindowMinutes:30,topActivePages:[]}};
  else if(url.pathname.endsWith('/analytics/traffic'))body={traffic:{todayByHour:[],byDay:[]}};
  else if(url.pathname.endsWith('/analytics/content'))body={content:{pages:[],vendors:{filters:[]},map:{sources:[],locations:[]},schedule:{filters:[],mostOpenedEvents:[]},announcements:{openSources:[],ranking:[]},queenOfTheFurrow:{},quickActions:{actions:[],destinationTypes:[],sources:[]},outboundLinks:{destinations:[],destinationTypes:[]},featureAdoption:[],eventDayComparisons:[]}};
  else if(url.pathname.endsWith('/notification-health') && url.searchParams.get('view')==='summary')body={ready_devices:0,readiness_outdated:false,status:'empty',message:'No notification devices registered yet.',snapshot_at:'2026-09-18T23:00:00Z'};
  else if(url.pathname.endsWith('/notification-health'))body={registrations:0,checked:0,not_yet_checked:0,verified:0,repairable_mismatch:0,key_mismatch:0,other_ineligible:0,other_checked:0,uncertain:0,active_leases:0,expired_leases:0,retries_due:0,retries_scheduled:0,provider_ready:0,provider_ready_stale:0,verified_expired:0,current_check_failures:0,circuit:'CLOSED',snapshot_at:null,latest_activity_at:null};
  else body={announcements:[],deliveries:[],vendors:[],events:[],total_count:0};
  return route.fulfill({json:body});
 }
 if(url.origin===new URL(base).origin)return route.continue();
 return route.abort();
});
try{
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const name of Object.keys(cases)){
   current=name;
   // Enter via the established desktop navigation, then exercise each responsive layout.
   await page.setViewportSize({width:1440,height:1000});
   await page.goto(base+'/admin/',{waitUntil:'domcontentloaded'});
   await page.getByText('Analytics',{exact:true}).first().click();
   await page.setViewportSize({width,height:1000});
   const panel=page.getByLabel('Notification performance overview');
   await panel.getByLabel('Reminders requested',{exact:true}).getByText('7',{exact:true}).waitFor();
   const a=panel.getByLabel('Announcement notification summary');
   if(cases[name].accepted_sends===0)await a.getByText('No announcement requests sent to WonderPush yet.',{exact:true}).waitFor();
   else{
    for(const [key,label] of Object.entries({targeted_devices:'Devices targeted',receipts:'Confirmed receipts',opens:'Notification taps',visits:'Opened from notification',failures:'Provider-reported delivery failures'})){
     const metric=cases[name].metrics[key],card=a.getByLabel(label,{exact:true});
     if(key==='targeted_devices' && metric.value==null){assert.equal(await card.count(),0);continue;}
     await card.getByText(metric.value==null?'Unavailable':metric.value.toLocaleString(),{exact:true}).waitFor();
     assert.ok((await card.innerText()).includes(`Data available for ${metric.covered_sends} of ${metric.total_sends} sends`));
    }
   }
   if(name==='historical'){
    await a.getByText('Detailed delivery data available for 0 of 2 sends',{exact:true}).waitFor();
    await a.getByText('Detailed provider statistics were not uniquely attributable for these earlier sends.',{exact:true}).waitFor();
    for(const title of new Set(cases[name].recent.map(send=>send.title))) await a.getByText(title,{exact:true}).first().waitFor();
   }
   if(name==='failures'){
    assert.equal(await a.getByLabel('Failed send requests',{exact:true}).getByText('1',{exact:true}).count(),1);
    assert.equal(await a.getByLabel('Pending / unknown requests',{exact:true}).getByText('1',{exact:true}).count(),1);
   }
   const reminders=panel.getByLabel('T-30 reminder analytics');
   for(const label of ['Reminders sent','Phones that received it','Reminders opened','Failed']) assert.equal(await reminders.getByLabel(label,{exact:true}).getByText('Not available',{exact:true}).count(),1);
   assert.doesNotMatch(await panel.innerText(),/\d%|\d+\s+unique (people|devices)|installation_id|push_token|capability|claim IDs/i);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(['historical','mixed','partial'].includes(name)){
    await page.setViewportSize({width,height:2400});
    await panel.screenshot({path:`${artifacts}/${name}-${width}.png`});
    await page.setViewportSize({width,height:1000});
   }
   console.log(`PASS ${name} ${width}px`);
  }
 }
 unavailable=true;
 await page.getByText('Refresh',{exact:true}).first().click();
 await page.getByText('Notification summary is temporarily unavailable.',{exact:true}).waitFor();
 assert.equal(await page.getByText('No announcement requests sent to WonderPush yet.',{exact:true}).count(),0);
 await page.getByRole('button',{name:'View announcement details →'}).click();
 await page.getByText('No announcements yet',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
 console.log('PASS error state, Announcements navigation, zero API mutations / provider calls');
}finally{await browser.close();}
