// All API traffic is fulfilled in-browser; no notification or analytics reaches a live service.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.ANALYTICS_UI_URL || 'http://localhost:8094';
const did='00000000-0000-4000-8000-000000000010',aid='00000000-0000-4000-8000-000000000011';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});
const events=[], visits=new Set();
const item={id:aid,title:'Attribution fixture',message:'No notification sent',status:'published',priority:'Information',created_by:'Fixture',created_at:'2026-09-18T22:00:00Z',expires_at:null,image:null};
await context.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.pathname.startsWith('/api/')) {
  if(url.pathname==='/api/activity/events') {
   for(const event of req.postDataJSON().events) {events.push(event);if(event.eventName==='notification_origin_visit') visits.add(event.properties.delivery_id+':'+event.properties.navigation_id);}
   return route.fulfill({json:{accepted:1,duplicates:0}});
  }
  if(url.pathname.startsWith('/api/activity/')) return route.fulfill({json:{eventScope:'ipm-2026',status:'ok'}});
  if(req.method()!=='GET') return route.abort();
  if(url.pathname==='/api/announcements/'+aid)return route.fulfill({json:item});
  if(url.pathname==='/api/announcements')return route.fulfill({json:{announcements:[item],total_count:1}});
  return route.fulfill({json:{vendors:[],events:[],schedule:[],total_count:0}});
 }
 return url.origin===new URL(base).origin?route.continue():route.abort();
});
const page=await context.newPage();
async function waitVisits(n){await page.waitForFunction(()=>true);for(let i=0;i<60&&visits.size<n;i++)await page.waitForTimeout(100);assert.equal(visits.size,n);}
try {
 await page.goto(base+`/announcements/${aid}?notification_ref=${did}`,{waitUntil:'domcontentloaded'});
 await waitVisits(1);
 const first=[...visits][0];
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(3500);
 assert.equal(visits.size,1);assert.equal([...visits][0],first);
 await page.goto(base+`/announcements/${aid}`,{waitUntil:'domcontentloaded'});await page.waitForTimeout(3000);
 assert.equal(visits.size,1);
 assert.ok(events.some(e=>e.eventName==='announcement_opened'&&e.properties.source!=='notification'));
 await page.goto(base+`/announcements/${aid}?notification_ref=${did}`,{waitUntil:'domcontentloaded'});await waitVisits(2);
 assert.ok(events.filter(e=>e.eventName==='notification_origin_visit').length>=3);
 console.log('PASS notification navigation=1, reload=1, normal open=1, new notification navigation=2; all API requests mocked');
}finally{await browser.close();}
