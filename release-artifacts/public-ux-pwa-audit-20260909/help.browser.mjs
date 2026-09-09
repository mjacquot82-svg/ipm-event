import {chromium} from '/home/codespace/.npm/_npx/dd48173ecf795e2b/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const base=process.env.IPM_TEST_URL||'http://localhost:8113';
const b=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',headless:true,args:['--no-sandbox']});
for(const width of [390,1440]){
 const c=await b.newContext({viewport:{width,height:900},serviceWorkers:'block'});
 await c.addInitScript(()=>{
 Object.defineProperty(navigator,'standalone',{configurable:true,value:true});
 Object.defineProperty(window,'Notification',{configurable:true,value:{permission:'granted'}});
 const reg={update:async()=>{},active:{state:'activated'},waiting:null,installing:null,pushManager:{getSubscription:async()=>null}};
 navigator.serviceWorker.register=async()=>reg;navigator.serviceWorker.getRegistration=async()=>reg;
 window.WonderPush={push(v){if(typeof v==='function')v();},isSubscribedToNotifications:async()=>true,getInstallationId:async()=>null,getUserId:async()=>null};
 });
 await c.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(q.method()!=='GET')return r.abort();if(u.hostname==='cdn.by.wonderpush.com')return r.fulfill({body:'/* inert fixture */',contentType:'application/javascript'});if(u.origin===new URL(base).origin&&!u.pathname.startsWith('/api/'))return r.continue();return r.abort();});
 const p=await c.newPage();await p.goto(base+'/about');await p.getByRole('button',{name:'App help',exact:true}).click();
 await p.getByText('Notifications enabled',{exact:true}).waitFor();await p.waitForTimeout(2500);
 const text=await p.locator('body').innerText();assert(!/notification delivery is not verified|Setup reference|KEY_MISMATCH|VERIFIED|reconciliation|Try again/.test(text));
 await p.getByRole('button',{name:'Read app status',exact:true}).click();await p.getByText('Offline worker controls this page:',{exact:false}).waitFor();
 const status=await p.getByText('This snapshot cannot tell',{exact:false}).innerText();assert(!/endpoint|token|webKey|registrationId|installationId/i.test(status));
 await p.getByText('IPM is on your Home Screen · Help',{exact:true}).click();await p.getByText('Do I need to install IPM?',{exact:true}).waitFor();
 await p.screenshot({path:`${new URL('.',import.meta.url).pathname}help-${width}.png`});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log('PASS',base,width,'enabled enrollment despite unavailable backend; explicit install help; privacy-safe status');await c.close();
}
await b.close();
