// Provider-isolated fixture checks against a local build or staging preview.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const base=process.env.IPM_TEST_URL||'http://localhost:8097';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
for(const width of [390,1440]){
 const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
 await c.addInitScript(()=>{localStorage.setItem('@ipm_schedule_itinerary_onboarding_v1','true');Object.defineProperty(window,'Notification',{value:{permission:'default'},configurable:true});});
 let attemptedWrites=0;
 await c.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(r.method()!=='GET'){attemptedWrites++;return route.abort();}
  if(u.pathname==='/api/schedule')return route.fulfill({json:{source:'supabase',events:[1,2,3].map(n=>({id:'11111111-1111-4111-8111-11111111111'+n,title:'Fixture event '+n,start_date:'2026-09-22',start_time:'10:00',end_time:'11:00',category:'entertainment',description:'Fixture',location_name:'Fixture tent'})),last_updated:'2026-09-08T12:00:00Z'}});
  if(u.origin===new URL(base).origin&&!u.pathname.startsWith('/api/'))return route.continue();
  return route.abort();
 });
 const page=await c.newPage();page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByText('Use IPM now',{exact:true}).waitFor();
 assert.equal(await page.getByText('Do I need to install IPM?',{exact:true}).count(),0);
 await page.goto(base+'/schedule',{waitUntil:'domcontentloaded'});await page.waitForTimeout(2500);

 await page.getByRole('button',{name:'Add Fixture event 1 to itinerary',exact:true}).click();
 await page.getByText('Added to Personal Itinerary',{exact:true}).waitFor();
 assert.equal(await page.getByText('Not now',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Add Fixture event 2 to itinerary',exact:true}).click();
 await page.getByText('Your itinerary is saved.',{exact:false}).waitFor();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('@event_navigator_favorites')).sessionIds),['11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112']);
 await page.waitForTimeout(2900);
 await page.screenshot({path:`/tmp/ipm-consolidated-suggestion-${width}.png`});
 await page.getByText('Not now',{exact:true}).click();
 await page.getByRole('button',{name:'Add Fixture event 3 to itinerary',exact:true}).click();
 assert.equal(await page.getByText('Not now',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Remove Fixture event 1 from itinerary',exact:true}).click();
 await page.getByText('Removed from your itinerary',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Add Fixture event 1 to itinerary',exact:true}).click();
 assert.equal(await page.getByText('Not now',{exact:true}).count(),0);
 await page.goto(base+'/itinerary',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Remove Fixture event 1 from itinerary',exact:true}).click();
 await page.getByText('Removed from your itinerary',{exact:true}).waitFor();
 console.log('PASS',base,width,'onboarding, save, confirmations, nonblocking dismissal, cooldown, no overflow; blocked write attempts',attemptedWrites);
 await c.close();
}
// Granted permission must never show the offer, even after repeated additions.
const c=await browser.newContext({serviceWorkers:'block'});
await c.addInitScript(()=>{localStorage.setItem('@ipm_schedule_itinerary_onboarding_v1','true');Object.defineProperty(window,'Notification',{value:{permission:'granted'},configurable:true});});
await c.route('**/*',async route=>{
 const r=route.request(),u=new URL(r.url());
 if(r.method()!=='GET')return route.abort();
 if(u.pathname==='/api/schedule')return route.fulfill({json:{source:'supabase',events:[1,2,3].map(n=>({id:'11111111-1111-4111-8111-11111111111'+n,title:'Fixture event '+n,start_date:'2026-09-22',start_time:'10:00',category:'entertainment'}))}});
 if(u.origin===new URL(base).origin&&!u.pathname.startsWith('/api/'))return route.continue();
 return route.abort();
});
const p=await c.newPage();await p.goto(base+'/schedule',{waitUntil:'domcontentloaded'});
for(const n of [1,2,3])await p.getByRole('button',{name:`Add Fixture event ${n} to itinerary`,exact:true}).click();
assert.equal(await p.getByText('Not now',{exact:true}).count(),0);console.log('PASS granted permission no suggestion');
await browser.close();
