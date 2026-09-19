// Original contextual first-run flow, then replay from the actual cached PWA shell.
import assert from 'node:assert/strict';import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL||'http://127.0.0.1:8870';assert(base.startsWith('http://127.0.0.1:'));
const schedule=JSON.parse(fs.readFileSync(new URL('./fixtures/map-education-schedule.json',import.meta.url)));
const catalog=JSON.parse(fs.readFileSync(new URL('../public/api/vendors.json',import.meta.url)));const vendor=catalog.vendors.find(v=>v.name==='Ontario Government');
const browser=await chromium.launch();
try{
 const c=await browser.newContext({viewport:{width:390,height:950}});
 await c.route('**/*',r=>{const q=r.request(),u=q.url();if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':q.headers()['access-control-request-headers']||'content-type'}});if(q.method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(u)&&!u.startsWith(base))return r.abort();if(u.endsWith('/api/schedule'))return r.fulfill({json:schedule,headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true'}});if(u.endsWith('/api/vendors'))return r.fulfill({json:{...catalog,vendors:[vendor]}});return r.continue();});
 const p=await c.newPage(),tip=p.getByTestId('map-education-card');
 await p.goto(base+'/schedule');await p.getByText('Plan your day',{exact:true}).waitFor();await p.getByRole('button',{name:'Got it, close Plan your day introduction'}).click();await p.getByText(schedule.events[0].title,{exact:true}).first().scrollIntoViewIfNeeded();await tip.getByText('View event details',{exact:true}).waitFor();await p.getByTestId('schedule-education-open-event').click();await p.getByTestId('schedule-find-on-map').scrollIntoViewIfNeeded();await tip.getByText('Find this event',{exact:true}).waitFor();await tip.getByRole('button',{name:'Got it',exact:true}).click();
 await p.goto(base+'/vendors');await tip.getByText('Find this vendor',{exact:true}).waitFor();await tip.getByRole('button',{name:'Got it',exact:true}).click();await p.getByTestId('vendor-find-on-map').scrollIntoViewIfNeeded();await tip.getByText('Find this vendor',{exact:true}).waitFor();await tip.getByRole('button',{name:'Got it',exact:true}).click();
 await p.goto(base+'/map');for(let i=0;i<5;i++){await tip.getByText(`${i+1} of 5`,{exact:true}).waitFor();await tip.getByRole('button',{name:i===4?'Got it':'Next',exact:true}).click();}
 await p.evaluate(async()=>{await navigator.serviceWorker.register('/webpushr-sw.js');await navigator.serviceWorker.ready;});await p.waitForFunction(async()=>!!await caches.match('/index.html'));await p.waitForFunction(async()=>{const d=await(await fetch('/app-release.json')).json();return !!await caches.match(d.entry)});
 await c.unrouteAll({behavior:'wait'});await c.setOffline(true);
 await p.goto(base+'/schedule');const sh=p.getByRole('button',{name:'Schedule Help',exact:true});await sh.waitFor();assert.equal(await p.getByText('Plan your day',{exact:true}).count(),0);await sh.click();await p.getByText('Plan your day',{exact:true}).waitFor();await p.getByRole('button',{name:'Got it, close Plan your day introduction'}).click();
 await p.goto(base+'/vendors');const vh=p.getByRole('button',{name:'Vendors Help',exact:true});await vh.waitFor();await vh.click();await tip.getByText('Find this vendor',{exact:true}).waitFor();await tip.getByRole('button',{name:'Got it',exact:true}).click();
 await p.goto(base+'/map');await p.getByRole('button',{name:'Map Help, replay Maps tour',exact:true}).click();await tip.getByText('Find parking',{exact:true}).waitFor();assert.match(await tip.innerText(),/Grounds shows the overall site/);await p.getByRole('button',{name:'Skip Maps tour',exact:true}).click();
 assert.equal(await p.evaluate(()=>localStorage.getItem('@ipm_schedule_itinerary_onboarding_v1')),'true');assert.equal(await p.evaluate(()=>localStorage.getItem('@ipm_vendor_find_on_map_tip_seen_v1')),'true');
 console.log('PASS fresh Schedule introduction/details/map tips, fresh Vendor tip, fresh Maps tour; offline cached Schedule/Vendors/Maps replay and persisted completion');
 await c.close();
}finally{await browser.close();}
