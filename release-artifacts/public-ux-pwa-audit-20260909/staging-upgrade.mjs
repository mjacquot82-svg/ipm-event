import {chromium} from '/home/codespace/.npm/_npx/dd48173ecf795e2b/node_modules/playwright/index.mjs';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const A=new URL('.',import.meta.url).pathname,base='https://staging.theipm.ca';
const newEntry=readFileSync('/workspaces/ipm-event/.worktrees/public-ux-staging/frontend/dist/index.html','utf8').match(/src="(\/_expo[^\"]+)"/)[1];
const b=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',headless:true,args:['--no-sandbox']});const clients=[];
const snap=p=>p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return{entry:[...document.scripts].map(s=>new URL(s.src||location.href).pathname).find(s=>s.startsWith('/_expo/')),controlled:!!navigator.serviceWorker.controller,waiting:!!r?.waiting,installing:!!r?.installing,cache:await caches.keys(),favorites:localStorage.getItem('@event_navigator_favorites'),preference:localStorage.getItem('@ipm_home_notification_invitation_dismissed_v1'),subscriptionPresent:!!(await r?.pushManager.getSubscription())};});
for(const scenario of ['open','closed','offline','standalone']){
 const c=await b.newContext({viewport:{width:390,height:900}});await c.addInitScript(standalone=>{Object.defineProperty(navigator,'standalone',{configurable:true,value:standalone});if(window.PushManager)PushManager.prototype.subscribe=async()=>{throw Error('Forbidden by test');};if(window.PushSubscription)PushSubscription.prototype.unsubscribe=async()=>{throw Error('Forbidden by test');};},scenario==='standalone');
 await c.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(q.method()!=='GET')return r.abort();if(u.pathname==='/api/schedule')return r.fulfill({json:{events:[{id:'11111111-1111-4111-8111-111111111111',title:'Upgrade fixture event',start_date:'2026-09-22',start_time:'10:00',category:'entertainment'}],last_updated:'2026-09-09T00:00:00Z'}});if(u.origin===base||(u.hostname==='cdn.by.wonderpush.com'&&u.pathname.includes('/sdk/')))return r.continue();return r.abort();});
 const p=await c.newPage();await p.goto(base+'/about');await p.waitForFunction(()=>!!navigator.serviceWorker.controller,{},{timeout:45000});await p.evaluate(()=>{localStorage.setItem('@event_navigator_favorites',JSON.stringify({sessionIds:['11111111-1111-4111-8111-111111111111']}));localStorage.setItem('@ipm_home_notification_invitation_dismissed_v1','true');});await p.reload();const before=await snap(p);assert.notEqual(before.entry,newEntry);
 if(scenario==='closed')await p.close();if(scenario==='offline')await c.setOffline(true);clients.push({scenario,c,p,before});console.log('READY',scenario,before.entry);
}
writeFileSync(A+'staging-client-ready.json',JSON.stringify(clients.map(({scenario,before})=>({scenario,before})),null,2));
const start=Date.now();while(!existsSync(A+'staging-published.json')){assert(Date.now()-start<600000,'staging publish timed out');await new Promise(r=>setTimeout(r,1000));}
const results=[];
for(let {scenario,c,p,before} of clients){
 if(scenario==='closed'){p=await c.newPage();await p.goto(base+'/about');}
 if(scenario==='offline'){await p.reload();assert.equal((await snap(p)).entry,before.entry);await c.setOffline(false);}
 const firstOpen=await snap(p);await p.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration('/')).update();});
 await p.waitForTimeout(4000);const afterUpdate=await snap(p);
 await p.close();await new Promise(r=>setTimeout(r,800));p=await c.newPage();await p.goto(base+'/itinerary');await p.getByRole('button',{name:'Remove Upgrade fixture event from itinerary',exact:true}).waitFor();let reopened=await snap(p);
 // If reopened before the update finished downloading, let that installation finish and perform one clean reopen.
 if(reopened.entry!==newEntry){await p.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration('/')).update();});await p.waitForTimeout(4000);await p.close();await new Promise(r=>setTimeout(r,800));p=await c.newPage();await p.goto(base+'/itinerary');await p.getByRole('button',{name:'Remove Upgrade fixture event from itinerary',exact:true}).waitFor();reopened=await snap(p);}
 assert.equal(reopened.entry,newEntry);assert.equal(reopened.favorites,before.favorites);assert.equal(reopened.preference,'true');assert.equal(reopened.subscriptionPresent,before.subscriptionPresent);
 await c.setOffline(true);await p.reload();await p.getByRole('button',{name:'Remove Upgrade fixture event from itinerary',exact:true}).waitFor();await c.setOffline(false);
 await p.goto(base);await p.getByText('IPM 2026 Starts In',{exact:true}).waitFor();let reloads=0;p.on('framenavigated',f=>{if(f===p.mainFrame())reloads++;});await p.waitForTimeout(3500);assert(reloads<=1,'reload loop');
 results.push({scenario,before,firstOpen,afterUpdate,reopened,reloads});writeFileSync(A+'staging-upgrade.json',JSON.stringify(results,null,2));console.log('PASS',scenario,'existing staging client survived deployment; itinerary/preference/offline/deep link preserved');await c.close();
}
await b.close();
