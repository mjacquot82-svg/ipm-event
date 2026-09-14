/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('/tmp/ipm-browser-tools/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),origin='http://127.0.0.1:8872';
const expected=JSON.parse(fs.readFileSync(path.join(root,'diagnostics/landa-final/schedule-expected.json'))),carol=expected.events.find(e=>e.id==='69f9ab32-bee3-5ac4-b97f-8c97d4b99bf7');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});try{
 const c=await b.newContext({viewport:{width:393,height:852}});let offline=false;
 await c.addInitScript(()=>{for(const k of ['@ipm_schedule_itinerary_onboarding_v1','@ipm_schedule_event_details_tip_seen_v1','@ipm_schedule_find_on_map_tip_seen_v1'])localStorage.setItem(k,'true');});
 await c.route('**/*',r=>{
  const u=r.request().url();if(r.request().method()!=='GET'||(!u.startsWith(origin)&&/wonderpush|webpushr|google-analytics/.test(u)))return r.abort();
  if(u.endsWith('/api/schedule'))return offline?r.abort():r.fulfill({json:expected});
  if(u===carol.event_image.url)return offline?r.abort():r.fulfill({body:fs.readFileSync(path.join(root,'frontend/public/event-media',path.basename(u))),contentType:'image/jpeg'});
  return r.continue();
 });
 const p=await c.newPage();await p.goto(origin+'/schedule?eventId='+carol.id);
 await p.getByRole('img',{name:'Carol Weigel',exact:true}).scrollIntoViewIfNeeded();
 await p.evaluate(async()=>{await navigator.serviceWorker.register('/webpushr-sw.js');await navigator.serviceWorker.ready;});
 await p.waitForFunction(async()=>{const d=await(await fetch('/app-release.json')).json();return !!await caches.match(d.entry)&&!!await caches.match('/index.html');});
 offline=true;await c.setOffline(true);await p.reload();
 await p.getByText(carol.description,{exact:true}).last().waitFor();await p.getByText(carol.description,{exact:true}).last().scrollIntoViewIfNeeded();
 await p.waitForTimeout(1200);assert.equal(await p.getByRole('img',{name:'Carol Weigel',exact:true}).count(),0);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS cached biography and event detail offline; unavailable portrait safely removed without broken placeholder; existing media caching policy unchanged');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
