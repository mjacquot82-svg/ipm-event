// Local two-generation integration test. Provider loading is stubbed; no provider requests.
const { chromium } = require(process.env.IPM_PLAYWRIGHT_MODULE || '/tmp/ipm-browser-tools/node_modules/playwright');
const http = require('node:http');
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const compiled = ts.transpileModule(fs.readFileSync(path.join(root,'src/services/pwaUpdateService.web.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
let version='A';
const html=v=>`<html><body><h1>Version ${v}</h1><button id="refresh" hidden>Refresh</button><script src="/_expo/static/js/web/entry-${v}.js"></script></body></html>`;
const script=v=>`var module={exports:{}};var exports=module.exports;${compiled}\nwindow.updater=module.exports;updater.setPwaUpdateSafeState(true);updater.subscribePwaUpdate(s=>document.querySelector('#refresh').hidden=!s.visible);document.querySelector('#refresh').onclick=()=>updater.activatePwaUpdate();navigator.serviceWorker.register('/webpushr-sw.js?webKey=fixture',{scope:'/'}).then(r=>{updater.startPwaUpdateFlow(r);window.started=true});`;
const template=fs.readFileSync(path.join(root,'public/webpushr-sw.js'),'utf8');
const server=http.createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');const p=new URL(req.url,'http://localhost').pathname;
 if(p==='/app-release.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({entry:`/_expo/static/js/web/entry-${version}.js`}));}
 if(p==='/webpushr-sw.js'){res.setHeader('Content-Type','application/javascript');return res.end(template.replace('https://cdn.by.wonderpush.com/sdk/1.1/wonderpush-loader.min.js','/provider-stub.js').replace("'development'",`'${version}'`).replace("['/', '/index.html', '/manifest.json']",JSON.stringify(['/','/index.html',`/_expo/static/js/web/entry-${version}.js`])));}
 if(p==='/provider-stub.js'){res.setHeader('Content-Type','application/javascript');return res.end('self.WonderPush=[];');}
 if(p.startsWith('/_expo/')){res.setHeader('Content-Type','application/javascript');return res.end(script(p.match(/entry-(\w+)\.js/)[1]));}
 res.setHeader('Content-Type','text/html');res.end(html(version));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
 const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.waitForFunction(()=>window.started && navigator.serviceWorker.controller);
 const keys=['personal-itinerary','starred-events','announcement-dismissals','wonderpush-installation','local-preferences'];
 await page.evaluate(keys=>keys.forEach(k=>localStorage.setItem(k,'keep')),keys);
 const permission=await page.evaluate(()=>Notification.permission);
 async function resume(ms){await page.evaluate(ms=>{let visibility='hidden';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visibility});document.dispatchEvent(new Event('visibilitychange'));const now=Date.now;Date.now=()=>now()+ms;visibility='visible';document.dispatchEvent(new Event('visibilitychange'));Date.now=now;},ms);}
 version='B';await resume(599999);await page.waitForTimeout(100);assert.equal(await page.locator('#refresh').isVisible(),false);
 await resume(600000);await page.locator('#refresh').waitFor({state:'visible'});assert.equal(await page.locator('h1').textContent(),'Version A');
 let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
 await page.locator('#refresh').click();await page.getByRole('heading',{name:'Version B',exact:true}).waitFor();await page.waitForFunction(()=>window.started);await page.waitForTimeout(300);
 assert.equal(navigations,1);await resume(600000);await page.waitForTimeout(100);assert.equal(await page.locator('#refresh').isVisible(),false);assert.equal(navigations,1);
 assert.deepEqual(await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),keys),keys.map(()=> 'keep'));
 assert.equal(await page.evaluate(()=>Notification.permission),permission);
 await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'Version B',exact:true}).waitFor();await page.waitForFunction(()=>window.started);await resume(600000);assert.equal(await page.locator('#refresh').isVisible(),false);
 await context.setOffline(false);version='C';await page.reload();await page.getByRole('heading',{name:'Version C',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: real worker A→B explicit refresh exactly once; same release no-op; offline B; cold online C; storage/permission intact; no runtime errors. Provider stubbed.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
