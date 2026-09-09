import {chromium} from '/home/codespace/.npm/_npx/dd48173ecf795e2b/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const until=async(fn)=>{const end=Date.now()+45000;while(!(await fn())){assert(Date.now()<end,'condition timed out');await new Promise(r=>setTimeout(r,200));}};

const A=new URL('.',import.meta.url).pathname,base='http://localhost:8112',N=readFileSync(A+'n-path.txt','utf8'),M=A+'production-candidate';writeFileSync(A+'server-root.txt',N);
const b=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',headless:true,args:['--no-sandbox']});const c=await b.newContext();
await c.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(u.pathname==='/__audit'&&q.isNavigationRequest())return r.fulfill({contentType:'text/html',body:'<html><body>Isolated worker lifecycle probe</body></html>'});if(q.method()==='GET'&&u.origin===base)return r.continue();return r.abort();});
let p=await c.newPage();await p.goto(base+'/__audit');await p.evaluate(async()=>{await navigator.serviceWorker.register('/webpushr-sw.js',{scope:'/',updateViaCache:'none'});await navigator.serviceWorker.ready;localStorage.setItem('ipm-waiting-test','preserved');});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
// Omit the provider key deliberately in this isolated harness: the exact deployed
// worker follows its existing caught-provider-initialization-failure path.
writeFileSync(A+'server-root.txt',M);await p.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration('/')).update();});await until(()=>p.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration('/'))?.waiting));
const before=await p.evaluate(async()=>({waiting:!!(await navigator.serviceWorker.getRegistration('/')).waiting,controlled:!!navigator.serviceWorker.controller}));
assert.equal(before.waiting,true);await p.close();await new Promise(r=>setTimeout(r,1000));p=await c.newPage();await p.goto(base+'/__audit');const after=await p.evaluate(async()=>({waiting:!!(await navigator.serviceWorker.getRegistration('/')).waiting,active:(await navigator.serviceWorker.getRegistration('/')).active?.state,saved:localStorage.getItem('ipm-waiting-test')}));assert.equal(after.waiting,false);assert.equal(after.active,'activated');assert.equal(after.saved,'preserved');
writeFileSync(A+'waiting-worker.json',JSON.stringify({fixture:'provider initialization deliberately unavailable; exact production worker source',before,after},null,2));console.log('PASS waiting fallback activates after last controlled client closes; storage preserved');await b.close();
