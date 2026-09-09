import {chromium} from '/home/codespace/.npm/_npx/dd48173ecf795e2b/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const until=async(fn)=>{const end=Date.now()+45000;while(!(await fn())){assert(Date.now()<end,'condition timed out');await new Promise(r=>setTimeout(r,200));}};

const A=new URL('.',import.meta.url).pathname,N=readFileSync(A+'n-path.txt','utf8'),M=A+'production-candidate',base='http://localhost:8112';
const newEntry=readFileSync(M+'/index.html','utf8').match(/src="(\/_expo[^\"]+)"/)[1];
const b=await chromium.launch({executablePath:'/home/codespace/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',headless:true,args:['--no-sandbox']});
const results=[];
for(const scenario of ['open','closed','offline','standalone-chrome','ios-standalone-path']){
 writeFileSync(A+'server-root.txt',N);
 const standalone=scenario.includes('standalone'),c=await b.newContext({viewport:{width:390,height:900},...(scenario==='ios-standalone-path'?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'}:{})});
 await c.addInitScript(({standalone})=>{
 Object.defineProperty(navigator,'standalone',{configurable:true,value:standalone});
 window.__forbiddenPushWrites=0;
 if(window.PushManager)PushManager.prototype.subscribe=async()=>{window.__forbiddenPushWrites++;throw Error('Disabled by test');};
 if(window.PushSubscription)PushSubscription.prototype.unsubscribe=async()=>{window.__forbiddenPushWrites++;throw Error('Disabled by test');};
 if(window.Notification)Notification.requestPermission=async()=>{window.__forbiddenPushWrites++;throw Error('Disabled by test');};
 },{standalone});
 const event={id:'11111111-1111-4111-8111-111111111111',title:'Upgrade fixture event',start_date:'2026-09-22',start_time:'10:00',category:'entertainment',location_name:'Fixture tent'};
 await c.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(q.method()!=='GET')return r.abort();if(u.pathname==='/api/schedule')return r.fulfill({json:{events:[event],last_updated:'2026-09-09T00:00:00Z'}});if(u.origin===base||(u.hostname==='cdn.by.wonderpush.com'&&u.pathname.includes('/sdk/')))return r.continue();return r.abort();});
 let p=await c.newPage();await p.goto(base+'/schedule');await p.getByRole('button',{name:'Add Upgrade fixture event to itinerary',exact:true}).click();await p.getByText('Added to Personal Itinerary',{exact:true}).waitFor();
 await until(()=>p.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration('/'))?.active));await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await p.goto(base+'/about');await p.getByText('IPM App • Build',{exact:false}).waitFor();
 await p.evaluate(()=>localStorage.setItem('@ipm_home_notification_invitation_dismissed_v1','true'));
 const snap=()=>p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return{entry:[...document.scripts].map(s=>new URL(s.src||location.href).pathname).find(s=>s.startsWith('/_expo/')),controlled:!!navigator.serviceWorker.controller,waiting:!!r?.waiting,installing:!!r?.installing,cache:await caches.keys(),favorites:localStorage.getItem('@event_navigator_favorites'),dismissed:localStorage.getItem('@ipm_home_notification_invitation_dismissed_v1'),subscriptionPresent:!!(await r?.pushManager.getSubscription()),forbiddenPushWrites:window.__forbiddenPushWrites};});
 const before=await snap();assert(before.favorites.includes(event.id));let navigations=0;p.on('framenavigated',f=>{if(f===p.mainFrame())navigations++;});
 if(scenario==='closed'){await p.close();await new Promise(r=>setTimeout(r,700));}
 if(scenario==='offline')await c.setOffline(true);
 writeFileSync(A+'server-root.txt',M);
 if(scenario==='closed'){p=await c.newPage();await p.goto(base+'/about');}
 if(scenario==='offline'){await p.reload();assert.equal((await snap()).entry,before.entry);await c.setOffline(false);}
 // Explicit diagnostic update check isolates installation/activation from UA update-check throttling.
 await p.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration('/')).update();});
 const version=readFileSync(M+'/webpushr-sw.js','utf8').match(/IPM_OFFLINE_VERSION = '([^']+)'/)[1];
 await until(()=>p.evaluate(async v=>{const r=await navigator.serviceWorker.getRegistration('/');return !r?.installing&&(await caches.keys()).includes('ipm-offline-shell-'+v);},version));
 await p.waitForTimeout(1500);const after=await snap();assert.equal(after.entry,before.entry,'open JS remains version N');
 await p.close();await new Promise(r=>setTimeout(r,800));p=await c.newPage();await p.goto(base+'/itinerary');await p.getByRole('button',{name:'Remove Upgrade fixture event from itinerary',exact:true}).waitFor();
 const reopened=await snap();assert.equal(reopened.entry,newEntry);assert.equal(reopened.favorites,before.favorites);assert.equal(reopened.dismissed,'true');assert.equal(reopened.subscriptionPresent,before.subscriptionPresent);assert.equal(reopened.forbiddenPushWrites,0);
 await c.setOffline(true);await p.reload();await p.getByRole('button',{name:'Remove Upgrade fixture event from itinerary',exact:true}).waitFor();await c.setOffline(false);
 await p.goto(base+'/about');const build=await p.getByText('IPM App • Build',{exact:false}).innerText();await p.waitForTimeout(2500);assert.equal((await snap()).entry,newEntry);
 results.push({scenario,before,after,reopened,build,unexpectedNavigationsWhileOpen:navigations-(scenario==='offline'?1:0),subscriptionTest:'actual unsubscribed state preserved; no enrollment or unsubscribe allowed'});writeFileSync(A+'real-upgrade.json',JSON.stringify(results,null,2));console.log('PASS',scenario,build,'existing controlled client; favorites/dismissal; deep link; offline; no push mutations');await c.close();
}
await b.close();
