import test from 'node:test';
import {Buffer} from 'node:buffer';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const ts=require('typescript');
async function load(){
 const source=readFileSync(new URL('../src/services/subscriptionReconciliation.web.ts',import.meta.url),'utf8')
  .replaceAll("'./subscriptionReconciliationCore'",JSON.stringify(new URL('../src/services/subscriptionReconciliationCore.ts',import.meta.url).href))
  .replace('process.env.EXPO_PUBLIC_EVENT_ID', "'ipm-2026'")
  .replace('process.env.EXPO_PUBLIC_BACKEND_URL',"'https://ipm-backend-eoiw.onrender.com'");
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(code+'\n//'+Math.random()).toString('base64'));
}
test('launch, reconnect storms and foreground coalesce; in-flight Web Lock is shared',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:1000000});
 const originals={};for(const name of ['window','navigator','document','location','Notification','localStorage','fetch']) originals[name]=Object.getOwnPropertyDescriptor(globalThis,name);
 let requests=0,held=false;
 const key=new Uint8Array(65);key[0]=4;
 const sub={endpoint:'https://push.example.invalid/private',getKey:n=>n==='auth'?new Uint8Array(16).buffer:key.buffer,options:{applicationServerKey:key.buffer}};
 const win=new EventTarget();win.WonderPush={getInstallationId:async()=> 'b'.repeat(40),getUserId:async()=>null,isSubscribedToNotifications:async()=>true};
 const doc=new EventTarget();doc.visibilityState='visible';
 const nav={onLine:true,serviceWorker:{getRegistration:async()=>({scope:'https://theipm.ca/',active:{scriptURL:'https://theipm.ca/webpushr-sw.js'},pushManager:{getSubscription:async()=>sub}})},
 locks:{request:async(name,opts,cb)=>{assert.equal(opts.ifAvailable,true);if(held)return cb(null);held=true;try{return await cb({});}finally{held=false;}}}};
 const globals={window:win,document:doc,navigator:nav,location:{origin:'https://theipm.ca'},Notification:{permission:'granted'},localStorage:{getItem:()=> 'a'.repeat(43)},fetch:async(url)=>{if(url.endsWith('/pilot-eligibility'))return {ok:true,json:async()=>({pilot_eligible:true})};requests++;return {ok:true,json:async()=>({status:'VERIFIED',generation:1})};}};
 for(const [name,value] of Object.entries(globals))Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
 const flush=async()=>{for(let i=0;i<35;i++)await Promise.resolve();};
 try{
  const first=await load();const second=await load();const stop=first.startSubscriptionReconciliation();
  for(let i=0;i<100;i++)win.dispatchEvent(new Event('online'));
  t.mock.timers.tick(5000);await flush();
  const concurrent=await second.reconcileSubscription();assert.equal(concurrent.status,'DEFERRED');
  t.mock.timers.tick(1000);await flush();
  assert.equal(requests,1);
  nav.onLine=false;doc.dispatchEvent(new Event('visibilitychange'));t.mock.timers.tick(5000);await flush();assert.equal(requests,1);
  nav.onLine=true;for(let i=0;i<100;i++)win.dispatchEvent(new Event('online'));
  t.mock.timers.tick(5000);await flush();t.mock.timers.tick(1000);await flush();assert.equal(requests,2);
  stop();win.dispatchEvent(new Event('online'));t.mock.timers.tick(100000);await flush();assert.equal(requests,2);
 }finally{
  for(const [name,descriptor] of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
  t.mock.timers.reset();
 }
});

test('nonpilot and unavailable membership never read subscription or contact reconciliation',async()=>{
 const originals={};for(const n of ['window','navigator','document','location','Notification','localStorage','fetch']) originals[n]=Object.getOwnPropertyDescriptor(globalThis,n);
 let mode='nonpilot';let requests=0;
 const forbidden=()=>{throw new Error('Forbidden browser/provider mutation or read');};
 const globals={window:new EventTarget(),document:{visibilityState:'visible'},location:{origin:'https://theipm.ca'},Notification:{permission:'granted'},localStorage:{getItem:()=> 'a'.repeat(43)},navigator:{onLine:true,serviceWorker:{getRegistration:forbidden}},fetch:async url=>{requests++;assert.ok(url.endsWith('/pilot-eligibility'));return mode==='nonpilot'?{ok:true,json:async()=>({pilot_eligible:false})}:{ok:false};}};
 for(const [n,value] of Object.entries(globals))Object.defineProperty(globalThis,n,{value,configurable:true});
 try{
  const module=await load();let emissions=0;module.watchReconciliation(()=>emissions++);
  assert.equal((await module.reconcileSubscription()).status,'INELIGIBLE');
  mode='unavailable';assert.equal((await module.reconcileSubscription()).status,'DEFERRED');
  assert.equal(requests,2);assert.equal(emissions,0);
 }finally{for(const [n,d] of Object.entries(originals)){if(d)Object.defineProperty(globalThis,n,d);else delete globalThis[n];}}
});
