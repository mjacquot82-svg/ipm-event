import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';
const base='e93ead504d8734a0b35abce97bce59a36988d572';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const before=p=>execFileSync('git',['show',`${base}:frontend/${p}`],{encoding:'utf8'});
const worker=read('public/webpushr-sw.js');
test('WonderPush source, registration, permission and subscription code remain byte-identical',()=>{
 for(const p of ['src/services/wonderPushService.web.ts','src/services/wonderPushService.ts','src/services/notificationRegistration.web.ts','src/services/subscriptionReconciliation.web.ts','src/services/notificationDeepLink.web.ts'])assert.equal(read(p),before(p),p);
 assert.equal(worker.split('// Generated after')[0],before('public/webpushr-sw.js').split('// Generated after')[0]);
 assert.doesNotMatch(worker,/addEventListener\(['"](?:push|notificationclick)/);
});
test('currentLaunch and fetch handling identical to production',()=>{
 const extract=s=>s.slice(s.indexOf('const IPM_LAUNCH_TIMEOUT_MS'),s.indexOf('// Activation is requested')<0?undefined:s.indexOf('// Activation is requested')).trim();
 assert.equal(extract(worker),extract(before('public/webpushr-sw.js')));
});
test('production notification and install UI gains holds only',()=>{
 let s=read('src/components/NotificationOptIn.tsx').replace("import { holdPwaUpdate } from '../services/pwaUpdateService';\n",'').replace("  useEffect(() => {\n    if (expanded || working || setupState === 'pending') return holdPwaUpdate();\n  }, [expanded, working, setupState]);\n",'').replace('    const releaseUpdate = holdPwaUpdate();\n','').replace('      releaseUpdate();\n','');
 assert.equal(s,before('src/components/NotificationOptIn.tsx'));
 s=read('src/components/PWAInstallPrompt.tsx').replace("import { holdPwaUpdate } from '../services/pwaUpdateService';\n",'').replace('    return holdPwaUpdate();\n','');
 assert.equal(s,before('src/components/PWAInstallPrompt.tsx'));
});
test('approved updater mechanism is identical and does not depend on A/B marker',()=>{
 for(const p of ['src/services/pwaUpdateService.web.ts','src/services/pwaUpdateService.ts','src/components/PWAUpdatePrompt.tsx'])assert.equal(read(p),execFileSync('git',['show',`cdc6ed64:frontend/${p}`],{encoding:'utf8'}));
 assert.doesNotMatch(read('app/_layout.tsx')+read('src/components/PWAUpdatePrompt.tsx')+read('scripts/generate-offline-worker.js'),/Resume update test|pwaResumeTestVersion/);
 assert.match(read('scripts/generate-offline-worker.js'),/app-release.json/);
});
const origin='https://fixture.local';const html=v=>`<script src="/_expo/static/js/web/entry-${v}.js"></script>`;
function harness(){
 const stores=new Map();let fetcher=async()=>{throw Error('offline');};let claimed=0,skipped=0;
 const key=p=>new URL(typeof p==='string'?p:p.url,origin).href;
 function cache(name){if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);return {
  match:async p=>m.get(key(p))?.clone(),put:async(p,r)=>{m.set(key(p),r.clone());},keys:async()=>[...m.keys()].map(url=>new Request(url)),
  addAll:async paths=>{for(const p of paths)m.set(key(p),await fetcher(p));}
 };}
 const handlers={};const ctx=vm.createContext({URL,Request,Response,AbortController,setTimeout,clearTimeout,
 console:{error(){}},fetch:(...args)=>fetcher(...args),caches:{open:async n=>cache(n),keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n)},
 self:{location:{href:origin+'/webpushr-sw.js',origin},clients:{claim:async()=>{claimed++;}},skipWaiting:async()=>{skipped++;},addEventListener:(n,f)=>handlers[n]=f}});
 vm.runInContext(worker,ctx);
 return {stores,cache,handlers,setFetch:f=>fetcher=f,counts:()=>({claimed,skipped}),async event(n,data){let task;handlers[n]({data,waitUntil:p=>task=p});await task;},launch:()=>vm.runInContext("currentLaunch({url:'https://fixture.local/'})",ctx)};
}
async function seed(h,name,v){const c=h.cache(name);await c.put('/index.html',new Response(html(v)));await c.put(`/_expo/static/js/web/entry-${v}.js`,new Response('// '+v));}
test('migration carries exact live-style cached shell while offline; activation retains it',async()=>{
 const h=harness();await seed(h,'ipm-offline-shell-live','A');await h.cache('provider-cache').put('/keep',new Response('keep'));
 await h.event('install');assert.deepEqual(h.counts(),{claimed:0,skipped:0});await h.event('activate');assert.equal(await (await h.launch()).text(),html('A'));assert(h.stores.has('provider-cache'));assert(!h.stores.has('ipm-offline-shell-live'));assert.equal(h.counts().skipped,0);
});
test('activation during currentLaunch cannot delete the newer shell',async()=>{
 const h=harness();await seed(h,'ipm-offline-shell-live','A');await h.event('install');let release;
 h.setFetch(async p=>typeof p!=='string'?new Promise(r=>release=r):new Response('// B',{headers:{'content-type':'application/javascript'}}));
 const navigating=h.launch();await new Promise(setImmediate);await h.event('activate');release(new Response(html('B'),{headers:{'content-type':'text/html'}}));assert.equal(await (await navigating).text(),html('B'));h.setFetch(async()=>{throw Error('offline');});assert.equal(await (await h.launch()).text(),html('B'));
});
test('incomplete old cache is skipped in favor of a complete shell',async()=>{
 const h=harness();await seed(h,'ipm-offline-shell-good','A');await h.cache('ipm-offline-shell-bad').put('/index.html',new Response(html('broken')));await h.event('install');assert.equal(await (await h.launch()).text(),html('A'));
});
test('only the explicit Refresh message invokes skipWaiting',async()=>{
 const h=harness();await h.event('message',{type:'anything-else'});assert.equal(h.counts().skipped,0);await h.event('message',{type:'IPM_ACTIVATE_UPDATE'});assert.equal(h.counts().skipped,1);
});
