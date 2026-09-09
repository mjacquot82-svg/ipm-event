import {chromium} from '/home/codespace/.npm/_npx/dd48173ecf795e2b/node_modules/playwright/index.mjs';
import {existsSync,readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const A=new URL('.',import.meta.url).pathname,base=process.env.IPM_TEST_URL||'https://staging.theipm.ca', preview=!!process.env.IPM_TEST_URL;
assert.equal(process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS,'1','Worker network controls must be enabled');
const browser=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',headless:true,args:['--no-sandbox']});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(fn,ms=60000)=>{const start=Date.now();while(!await fn()){assert(Date.now()-start<ms,'condition timed out');await pause(200);}};
const snapshot=page=>page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return{entry:[...document.scripts].map(s=>new URL(s.src||location.href).pathname).find(s=>s.startsWith('/_expo/')),controlled:!!navigator.serviceWorker.controller,active:r?.active?.state,waiting:!!r?.waiting,installing:!!r?.installing,cache:await caches.keys(),favorites:localStorage.getItem('@event_navigator_favorites'),preference:localStorage.getItem('@ipm_home_notification_invitation_dismissed_v1'),permission:Notification.permission,subscriptionPresent:!!await r?.pushManager.getSubscription(),path:location.pathname};});
const fixture={events:[{id:'11111111-1111-4111-8111-111111111111',title:'Upgrade fixture event',start_date:'2026-09-22',start_time:'10:00',category:'entertainment'}],last_updated:'2026-09-09T00:00:00Z'};
const clients=[];const results=[];
const trace=(name,data)=>appendFileSync(A+'network.jsonl',JSON.stringify({at:Date.now(),name,...data})+'\n');
const scenarios=preview?['browser320','installed360','desktop']:['browser320','installed360','desktop','closed','offline','slow','failed-asset','waiting'];
for(const name of scenarios){
 const width=name==='desktop'?1440:name==='browser320'?320:360;
 const context=await browser.newContext({viewport:{width,height:900},permissions:name==='desktop'?['notifications']:[]});
 const client={name,context,fault:null,reloads:0,requests:[],blockedWrites:0};
 context.on('requestfailed',r=>trace(name,{event:'failed',url:r.url(),worker:!!r.serviceWorker(),error:r.failure()}));
 context.on('response',async r=>{if(new URL(r.url()).origin===new URL(base).origin){const data={event:'response',url:r.url(),status:r.status(),worker:!!r.request().serviceWorker(),fromSW:r.fromServiceWorker(),headers:r.headers()};if((r.headers()['content-type']||'').includes('text/html'))try{data.entry=(await r.text()).match(/entry-[a-f0-9]+\.js/)?.[0];}catch{}trace(name,data);}});
 await context.addInitScript(installed=>{
  if(installed){Object.defineProperty(navigator,'standalone',{value:true});const original=window.matchMedia.bind(window);window.matchMedia=q=>q==='(display-mode: standalone)'?new Proxy(original(q),{get:(target,key)=>key==='matches'?true:typeof target[key]==='function'?target[key].bind(target):target[key]}):original(q);}
  if(window.PushManager)PushManager.prototype.subscribe=async()=>{throw Error('Enrollment prohibited by lifecycle test');};
  if(window.PushSubscription)PushSubscription.prototype.unsubscribe=async()=>{throw Error('Unsubscribe prohibited by lifecycle test');};
 },name==='installed360');
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  trace(name,{event:'request',url:req.url(),worker:!!req.serviceWorker(),fault:client.fault,offline:!!client.offline});
  if(client.offline && req.serviceWorker())return route.abort();
  if(name==='waiting'&&url.hostname==='cdn.by.wonderpush.com')return route.abort();
  if(req.method()!=='GET'){client.blockedWrites++;return route.abort();}
  if(url.pathname==='/api/schedule')return route.fulfill({json:fixture});
  if(url.origin!==new URL(base).origin && !(url.hostname==='cdn.by.wonderpush.com'&&(url.pathname.includes('/sdk/')||url.pathname.startsWith('/config/webkeys/'))))return route.abort();
  if(url.origin===new URL(base).origin){
   client.requests.push({path:url.pathname,worker:!!req.serviceWorker(),navigation:req.isNavigationRequest()});
   if(client.fault==='slow'&&['/','/index.html','/itinerary'].includes(url.pathname)&&req.serviceWorker()){await pause(6500);return route.abort();}
   if(client.fault==='asset'&&url.pathname.includes('/entry-')&&!url.pathname.endsWith(client.oldEntry.split('/').pop()))return route.abort();
  }
  return route.continue();
 });
 client.page=await context.newPage();await client.page.goto(base+'/about');await until(()=>client.page.evaluate(()=>!!navigator.serviceWorker.controller));
 await until(()=>client.page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return !r?.installing;}));
 await client.page.evaluate(()=>{localStorage.setItem('@event_navigator_favorites',JSON.stringify({sessionIds:['11111111-1111-4111-8111-111111111111']}));localStorage.setItem('@ipm_home_notification_invitation_dismissed_v1','true');});
 await client.page.goto(base+'/itinerary');await client.page.getByRole('button',{name:'Remove Upgrade fixture event from itinerary',exact:true}).waitFor();
 client.before=await snapshot(client.page);client.oldEntry=client.before.entry;client.page.on('framenavigated',f=>{if(f===client.page.mainFrame())client.reloads++;});
 if(preview){await client.page.goto(base);await client.page.getByText('IPM 2026 Starts In',{exact:true}).waitFor();await client.page.screenshot({path:A+'preview-'+name+'.png'});client.offline=true;await client.context.setOffline(true);await client.page.goto(base+'/itinerary');await client.page.getByRole('button',{name:'Remove Upgrade fixture event from itinerary',exact:true}).waitFor();results.push({name,before:client.before,offline:await snapshot(client.page)});await client.context.close();continue;}
 if(name==='closed')await client.page.close();
 if(name==='offline'){client.offline=true;await context.setOffline(true);}
 if(name==='slow')client.fault='slow';if(name==='failed-asset')client.fault='asset';
 clients.push(client);console.log('BASELINE',name,client.before.entry);
}
if(preview){writeFileSync(A+'preview-results.json',JSON.stringify({passed:true,results},null,2));await browser.close();process.exit(0);}
writeFileSync(A+'clients-ready.json',JSON.stringify(clients.map(c=>({name:c.name,before:c.before})),null,2));console.log('READY A clients preserved',flush());
for(const phase of ['B','C']){
 await until(()=>existsSync(A+phase+'-published.json'),900000);
 const expected=JSON.parse(readFileSync(A+phase+'-identity.json')).entry;
 for(const c of clients){
  let remain;
  if(!c.page.isClosed()){remain=await snapshot(c.page);assert.equal(remain.entry,c.oldEntry,'open app changed before navigation');assert.equal(c.reloads,0,'unexpected foreground reload');}
  if(c.name==='offline'){
   if(!c.page.isClosed())await c.page.close();c.page=await c.context.newPage();await c.page.goto(base+'/itinerary');await c.page.getByRole('button',{name:'Remove Upgrade fixture event from itinerary',exact:true}).waitFor();assert.equal((await snapshot(c.page)).entry,c.oldEntry);
   c.offline=false;await c.context.setOffline(false);await pause(1500);assert.equal((await snapshot(c.page)).entry,c.oldEntry,'reconnect reloaded open app');
  }
  let fallback;
  if(c.name==='slow'||c.name==='failed-asset'){
   c.fault=c.name==='slow'?'slow':'asset';if(!c.page.isClosed())await c.page.close();c.page=await c.context.newPage();const started=Date.now();await c.page.goto(base+'/itinerary');await c.page.getByRole('button',{name:'Remove Upgrade fixture event from itinerary',exact:true}).waitFor();fallback={...await snapshot(c.page),elapsedMs:Date.now()-started};writeFileSync(A+phase+'-'+c.name+'-fallback.json',JSON.stringify(fallback,null,2));assert.equal(fallback.entry,c.oldEntry,'fault must preserve old usable app');assert(fallback.elapsedMs<12000,'fallback unbounded');c.fault=null;
  }
  if(!c.page.isClosed())await c.page.close();c.page=await c.context.newPage();const started=Date.now();await c.page.goto(base+'/itinerary');await c.page.getByRole('button',{name:'Remove Upgrade fixture event from itinerary',exact:true}).waitFor();const fresh={...await snapshot(c.page),elapsedMs:Date.now()-started};
  writeFileSync(A+phase+'-'+c.name+'-fresh.json',JSON.stringify({fresh,expected},null,2));
  assert.equal(fresh.entry,expected,'FIRST clean online launch must get new entry');assert.equal(fresh.favorites,c.before.favorites);assert.equal(fresh.preference,c.before.preference);assert.equal(fresh.permission,c.before.permission);assert.equal(fresh.subscriptionPresent,c.before.subscriptionPresent);assert.equal(fresh.path,'/itinerary');
  await until(()=>c.page.evaluate(async()=>!(await navigator.serviceWorker.getRegistration('/'))?.installing));
  if(c.name==='waiting'){await until(()=>c.page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration('/'))?.waiting));fresh.waitingAfterInstall=true;}
  c.offline=true;await c.context.setOffline(true);await c.page.close();c.page=await c.context.newPage();await c.page.goto(base+'/itinerary');await c.page.getByRole('button',{name:'Remove Upgrade fixture event from itinerary',exact:true}).waitFor();const offline=await snapshot(c.page);assert.equal(offline.entry,expected);
  c.offline=false;await c.context.setOffline(false);await pause(1000);assert.equal((await snapshot(c.page)).entry,expected);
  c.reloads=0;c.page.on('framenavigated',f=>{if(f===c.page.mainFrame())c.reloads++;});
  results.push({phase,name:c.name,remain,fallback,fresh,offline,requests:c.requests.slice(-35)});c.oldEntry=expected;
  if(c.name==='closed')await c.page.close();if(c.name==='offline'){c.offline=true;await c.context.setOffline(true);}
  if(c.name==='slow')c.fault='slow';if(c.name==='failed-asset')c.fault='asset';
  writeFileSync(A+phase+'-partial-results.json',JSON.stringify(results.filter(r=>r.phase===phase),null,2));
  console.log('PASS',phase,c.name,'first launch',expected);
 }
 await pause(6000);for(const c of clients)assert.equal(c.reloads,0,'reload loop after reconnect');
 writeFileSync(A+phase+'-transition-results.json',JSON.stringify({passed:true,results:results.filter(r=>r.phase===phase)},null,2));console.log('COMPLETE',phase);
}
await browser.close();
function flush(){return '';}
