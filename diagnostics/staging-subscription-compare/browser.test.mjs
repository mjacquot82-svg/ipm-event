import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = 'https://staging.theipm.ca';
const resultKey = 'CURRENT_BROWSER_SUBSCRIPTION_MATCHES_PROVIDER';
const files = {
 '/api/subscription-compare.html': ['index.html', 'text/html'],
 '/api/subscription-compare.mjs': ['compare.mjs', 'text/javascript'],
 '/api/subscription-compare-page.mjs': ['page.mjs', 'text/javascript'],
};
for (const outcome of [true, false, 'unverifiable']) {
 test(`isolated browser comparison renders ${outcome}, only one request and no raw material`, async () => {
  const browser = await chromium.launch({headless:true});
  try {
   const context = await browser.newContext(); const calls = []; const errors = [];
   await context.route('**/*', async route => {
    const request=route.request();const url=new URL(request.url());calls.push({method:request.method(),path:url.pathname});
    if (url.origin === origin && files[url.pathname]) {
     const [file,type]=files[url.pathname];return route.fulfill({contentType:type,body:readFileSync(new URL(file,import.meta.url))});
    }
    assert.equal(url.origin,'https://ipm-staging-backend.onrender.com');
    assert.equal(url.pathname,'/api/staging-diagnostics/compare-subscription');
    assert.equal(request.method(),'POST');
    const payload=request.postDataJSON();
    assert.deepEqual(Object.keys(payload).sort(),['challenge','digests']);
    assert.equal(JSON.stringify(payload).includes('do-not-expose'),false);
    assert.equal(payload.challenge.length,64);
    const body=outcome==='unverifiable'?{[resultKey]:outcome}:{[resultKey]:outcome,endpoint_match:outcome,p256dh_match:true,auth_match:true,application_server_key_match:true};
    return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':origin},body:JSON.stringify(body)});
   });
   await context.addInitScript(() => {
    const forbidden=()=>{throw new Error('Forbidden mutation/SDK/storage access');};
    const key=new Uint8Array(65);key[0]=4;
    Object.defineProperty(window,'localStorage',{get:forbidden});
    window.WonderPush={init:forbidden,subscribeToNotifications:forbidden};
    Object.defineProperty(navigator,'serviceWorker',{value:{register:forbidden,getRegistration:async()=>({
     scope:'https://staging.theipm.ca/',active:{},update:forbidden,unregister:forbidden,
     pushManager:{subscribe:forbidden,getSubscription:async()=>({
      endpoint:'https://push.example.invalid/do-not-expose',getKey:name=>name==='auth'?new Uint8Array(16).buffer:key.buffer,
      options:{applicationServerKey:key.buffer},unsubscribe:forbidden,
     })},
    })}});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.name));
   await page.goto(origin+'/api/subscription-compare.html');
   assert.equal(calls.length,3);
   await page.getByRole('button',{name:'Compare current subscription once'}).click();
   await page.getByRole('button',{name:'Comparison complete'}).waitFor({state:'visible'});
   const output=await page.locator('#result').textContent();
   assert.match(output,new RegExp(`${resultKey} = ${outcome}`));
   assert.equal(output.includes('do-not-expose'),false);
   assert.equal(/[0-9a-f]{64}/.test(output),false);
   assert.equal(await page.locator('#compare').isDisabled(),true);
   assert.equal(calls.filter(c=>c.method==='POST').length,1);
   assert.equal(calls.length,4);assert.deepEqual(errors,[]);
   await context.close();
  } finally {await browser.close();}
 });
}
