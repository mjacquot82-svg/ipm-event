import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../src/services/pwaUpdateService.web.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const A='/_expo/static/js/web/entry-aaaa.js', B='/_expo/static/js/web/entry-bbbb.js';
function events(){const map=new Map();return {addEventListener(k,f){map.set(k,[...(map.get(k)||[]),f]);},removeEventListener(k,f){map.set(k,(map.get(k)||[]).filter(x=>x!==f));},dispatch(k){for(const f of map.get(k)||[])f();}};}
function harness({entry=B,store=new Map(),network=true,waiting=false}={}){
 let now=0,reloads=0,checks=0,updates=0,messages=0,state={};const timers=new Map();let timer=0;
 const document={...events(),scripts:[{src:A}],visibilityState:'visible'};
 const sw={...events(),controller:{}};
 const registration={waiting:waiting?{postMessage(m){assert.equal(m.type,'IPM_ACTIVATE_UPDATE');messages++;}}:null,installing:null,update:async()=>{updates++;}};
 const module={exports:{}};
 const ctx=vm.createContext({module,exports:module.exports,URL,AbortController,Date:{now:()=>now},Promise,
  document,navigator:{onLine:true,serviceWorker:sw},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},
  window:{location:{href:'https://test.local/',reload(){reloads++;}}},
  fetch:async(url,options)=>{checks++;assert.match(url,/^\/app-release.json\?resume=/);assert.equal(options.cache,'no-store');if(!network)throw Error('offline');return {ok:true,redirected:false,headers:{get:()=> 'application/json'},json:async()=>({entry})};},
  setTimeout(f){timers.set(++timer,f);return timer;},clearTimeout(id){timers.delete(id);}});
 vm.runInContext(compiled,ctx);const api=module.exports;api.subscribePwaUpdate(s=>state=s);api.setPwaUpdateSafeState(true);api.startPwaUpdateFlow(registration);
 return {api,ctx,sw,store,registration,stats:()=>({reloads,checks,updates,messages}),state:()=>state,
 async resume(duration=600000){document.visibilityState='hidden';document.dispatch('visibilitychange');now+=duration;document.visibilityState='visible';document.dispatch('visibilitychange');await new Promise(setImmediate);},
 timeout(){for(const f of [...timers.values()])f();}};
}
test('startup and active foreground never check or reload',()=>{const h=harness();assert.deepEqual(h.stats(),{reloads:0,checks:0,updates:0,messages:0});});
test('under ten minutes resumes without a request',async()=>{const h=harness();await h.resume(599999);assert.equal(h.stats().checks,0);});
test('exact threshold and newer release prompts without reload',async()=>{const h=harness();await h.resume();assert.equal(h.state().visible,true);assert.equal(h.stats().reloads,0);});
test('same release is a no-op',async()=>{const h=harness({entry:A});await h.resume();assert.equal(h.state().visible,false);assert.equal(h.stats().updates,0);});
test('network failure is non-disruptive',async()=>{const h=harness({network:false});await h.resume();assert.equal(h.state().visible,false);assert.equal(h.stats().reloads,0);});
test('offline resume makes no request',async()=>{const h=harness();h.ctx.navigator.onLine=false;await h.resume();assert.equal(h.stats().checks,0);});
test('Later dismisses until another qualifying background',async()=>{const h=harness();await h.resume();h.api.dismissPwaUpdate();assert.equal(h.state().visible,false);await h.resume(50);assert.equal(h.state().visible,false);await h.resume();assert.equal(h.state().visible,true);});
test('unsafe route defers prompt and prevents activation',async()=>{const h=harness();h.api.setPwaUpdateSafeState(false);await h.resume();await h.api.activatePwaUpdate();assert.equal(h.state().visible,false);assert.equal(h.stats().reloads,0);h.api.setPwaUpdateSafeState(true);assert.equal(h.state().visible,true);});
test('notification/install holds prevent prompt and refresh',async()=>{const h=harness();const release=h.api.holdPwaUpdate();await h.resume();await h.api.activatePwaUpdate();assert.equal(h.state().visible,false);assert.equal(h.stats().reloads,0);release();assert.equal(h.state().visible,true);release();});
test('explicit Refresh without waiting worker navigates once through currentLaunch',async()=>{const h=harness();await h.resume();await h.api.activatePwaUpdate();await h.api.activatePwaUpdate();h.sw.dispatch('controllerchange');assert.equal(h.stats().reloads,1);});
test('waiting worker requires explicit tap then controllerchange',async()=>{const h=harness({waiting:true});await h.resume();assert.equal(h.stats().messages,0);await h.api.activatePwaUpdate();assert.equal(h.stats().messages,1);assert.equal(h.stats().reloads,0);h.sw.dispatch('controllerchange');h.sw.dispatch('controllerchange');assert.equal(h.stats().reloads,1);});
test('spontaneous controllerchange never reloads',()=>{const h=harness();h.sw.dispatch('controllerchange');assert.equal(h.stats().reloads,0);});
test('route changes during activation cancel delayed reload',async()=>{const h=harness({waiting:true});await h.resume();await h.api.activatePwaUpdate();h.api.setPwaUpdateSafeState(false);h.sw.dispatch('controllerchange');h.api.setPwaUpdateSafeState(true);assert.equal(h.stats().reloads,0);});
test('hidden page cancels activation, never replays reload',async()=>{const h=harness({waiting:true});await h.resume();await h.api.activatePwaUpdate();await h.resume(50);h.sw.dispatch('controllerchange');assert.equal(h.stats().reloads,0);});
test('worker activation timeout is non-disruptive',async()=>{const h=harness({waiting:true});await h.resume();await h.api.activatePwaUpdate();h.timeout();h.sw.dispatch('controllerchange');assert.equal(h.stats().reloads,0);assert.equal(h.state().refreshing,false);});
test('durable same-target guard survives a fallback reload',async()=>{const h=harness();await h.resume();await h.api.activatePwaUpdate();const next=harness({store:h.store});await next.resume();assert.equal(next.state().visible,false);await next.api.activatePwaUpdate();assert.equal(next.stats().reloads,0);});
test('unavailable session storage fails closed',async()=>{const h=harness();h.ctx.sessionStorage.setItem=()=>{throw Error('blocked');};await h.resume();await h.api.activatePwaUpdate();assert.equal(h.stats().reloads,0);});
test('repeated foregrounds do not loop',async()=>{const h=harness();await h.resume();await h.api.activatePwaUpdate();for(let n=0;n<5;n++)await h.resume();assert.equal(h.stats().reloads,1);});
for(const key of ['itinerary','favourites','announcement-dismissals','notification-permission','wonderpush-installation','install-preferences'])test(`${key} storage survives`,async()=>{const store=new Map([[key,'saved']]);const h=harness({store});await h.resume();await h.api.activatePwaUpdate();assert.equal(store.get(key),'saved');assert.doesNotMatch(source,/localStorage|indexedDB|unsubscribe|unregister|requestPermission|\.clear\(/);});
test('no polling and no provider or cache mutation',()=>{assert.doesNotMatch(source,/setInterval|caches\.|skipWaiting|clients\.claim|WonderPush/);});
