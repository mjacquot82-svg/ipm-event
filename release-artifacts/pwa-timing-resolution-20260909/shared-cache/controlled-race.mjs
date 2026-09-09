import {chromium} from '/home/codespace/.npm/_npx/dd48173ecf795e2b/node_modules/playwright/index.mjs';
import {existsSync,readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const A=new URL('.',import.meta.url).pathname,base=process.env.IPM_TEST_URL||'https://staging.theipm.ca', preview=false;
assert.equal(process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS,'1','Worker network controls must be enabled');
const browser=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',headless:true,args:['--no-sandbox']});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(fn,ms=60000)=>{const start=Date.now();while(!await fn()){assert(Date.now()-start<ms,'condition timed out');await pause(200);}};
const snapshot=page=>page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return{entry:[...document.scripts].map(s=>new URL(s.src||location.href).pathname).find(s=>s.startsWith('/_expo/')),controlled:!!navigator.serviceWorker.controller,active:r?.active?.state,waiting:!!r?.waiting,installing:!!r?.installing,cache:await caches.keys(),favorites:localStorage.getItem('@event_navigator_favorites'),preference:localStorage.getItem('@ipm_home_notification_invitation_dismissed_v1'),permission:Notification.permission,subscriptionPresent:!!await r?.pushManager.getSubscription(),path:location.pathname};});
const fixture={events:[{id:'11111111-1111-4111-8111-111111111111',title:'Upgrade fixture event',start_date:'2026-09-22',start_time:'10:00',category:'entertainment'}],last_updated:'2026-09-09T00:00:00Z'};
const clients=[];const results=[];
const trace=(name,data)=>appendFileSync(A+'network.jsonl',JSON.stringify({at:Date.now(),name,...data})+'\n');
const scenarios=preview?['browser320','installed360','desktop']:['worker-check'];
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
 await context.addInitScript(()=>{window.__workerCalls=[];for(const [proto,key] of [[ServiceWorkerContainer.prototype,'register'],[ServiceWorkerRegistration.prototype,'update']]){const original=proto[key];proto[key]=function(...args){window.__workerCalls.push({key,at:performance.now()});return Reflect.apply(original,this,args);};}});
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

const c=clients[0];
const state=(phase,fault=null)=>writeFileSync(A+'proxy-state.json',JSON.stringify({phase,fault}));
const fresh=async(expected)=>{await c.page.close();c.page=await c.context.newPage();const started=Date.now();await c.page.goto(base+'/itinerary');await c.page.getByRole('button',{name:'Remove Upgrade fixture event from itinerary',exact:true}).waitFor();const snap={...await snapshot(c.page),elapsedMs:Date.now()-started};assert.equal(snap.entry,expected);assert(snap.elapsedMs<8000);for(const key of ['favorites','preference','permission','subscriptionPresent','path'])assert.equal(snap[key],c.before[key]);return snap;};
const ident=phase=>JSON.parse(readFileSync(A+phase+'-identity.json')).entry;

const begin=Date.now()/1000;state('B','activation-race');await c.context.setOffline(true);await c.context.setOffline(false);
const records=()=>readFileSync(A+'proxy-network.jsonl','utf8').trim().split('\n').map(x=>JSON.parse(x)).filter(x=>x.at>=begin);
await until(()=>records().some(x=>x.path==='/webpushr-sw.js'&&x.fault==='activation-race'&&!x.event),20000);
const launchStart=Date.now()/1000;const race=await fresh(ident('B'));await until(()=>records().some(x=>x.path==='/webpushr-sw.js'&&x.fault==='activation-race'&&x.event==='response'),20000);
const scriptStart=records().find(x=>x.path==='/webpushr-sw.js'&&x.fault==='activation-race'&&!x.event).at;
const scriptEnd=records().find(x=>x.path==='/webpushr-sw.js'&&x.fault==='activation-race'&&x.event==='response').at;
assert(scriptStart<=launchStart&&launchStart<scriptEnd,'navigation must start while actual worker script update is held');
await pause(3000);c.offline=true;await c.context.setOffline(true);const offline=await fresh(ident('B'));c.offline=false;await c.context.setOffline(false);state('B');
results.push({name:'controlled-activation-race',scriptStart,launchStart,scriptEnd,race,offline});
let baselineKeys;
for(let i=0;i<4;i++){const current=await fresh(ident('B'));await pause(3000);const state=await c.page.evaluate(async()=>({registrations:(await navigator.serviceWorker.getRegistrations()).length,calls:window.__workerCalls,keys:await Promise.all((await caches.keys()).map(async key=>({key,requests:(await(await caches.open(key)).keys()).map(r=>new URL(r.url).pathname).sort()})))}));assert.equal(state.registrations,1);assert.equal(state.keys.length,1);assert(state.calls.filter(x=>x.key==='register').length<=1);assert(state.calls.filter(x=>x.key==='update').length<=2);if(baselineKeys)assert.deepEqual(state.keys,baselineKeys);else baselineKeys=state.keys;results.push({name:'current-loop-'+i,current,state});}
let reloads=0;c.page.on('framenavigated',f=>{if(f===c.page.mainFrame())reloads++;});await pause(7000);assert.equal(reloads,0);writeFileSync(A+'controlled-race-results.json',JSON.stringify({passed:true,results},null,2));console.log('PASS controlled activation race and loops');await browser.close();
