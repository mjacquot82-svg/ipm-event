import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL||'http://localhost:8098';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const android='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
for(const [name,width,ua,installed,permission,dismissed] of [
 ['installed Android enabled',390,android,true,'granted',false],
 ['installed Android disabled',390,android,true,'default',false],
 ['Android first visit',390,android,false,'default',false],
 ['Android returning dismissed',390,android,false,'default',true],
 ['iPhone Safari',390,iphone,false,'unsupported',false],
 ['installed iPhone',390,iphone,true,'granted',false],
 ['denied',390,android,false,'denied',false],
 ['unsupported',390,android,false,'unsupported',false],
 ['small mobile',320,android,false,'default',false],
 ['desktop',1440,'Mozilla/5.0 Chrome/130.0',false,'default',false],
]) {
 const c=await browser.newContext({viewport:{width,height:900},userAgent:ua,serviceWorkers:'block'});
 await c.addInitScript(({installed,permission,dismissed})=>{
  window.__permissionRequests=0;
  if(permission==='unsupported'){delete window.Notification;}else Object.defineProperty(window,'Notification',{configurable:true,value:{permission,requestPermission:async()=>{window.__permissionRequests++;return permission;}}});
  Object.defineProperty(navigator,'standalone',{configurable:true,value:installed});
  const match=window.matchMedia.bind(window);window.matchMedia=q=>q==='(display-mode: standalone)'?{...match(q),matches:installed,addEventListener(){},removeEventListener(){}}:match(q);
  if(dismissed)localStorage.setItem('@ipm_home_notification_invitation_dismissed_v1','true');
  const reg={update:async()=>{},pushManager:{getSubscription:async()=>null}};
  if(navigator.serviceWorker){navigator.serviceWorker.register=async()=>reg;navigator.serviceWorker.getRegistration=async()=>reg;}
  window.WonderPush={push(value){if(typeof value==='function')value();},isSubscribedToNotifications:async()=>permission==='granted',getInstallationId:async()=>'0123456789abcdef0123456789abcdef',getUserId:async()=>null};
 },{installed,permission,dismissed});
 await c.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(r.request().method()!=='GET')return r.abort();
  if(u.hostname==='cdn.by.wonderpush.com')return r.fulfill({contentType:'application/javascript',body:'/* inert SDK fixture; no provider requests */'});
  if(u.origin===new URL(base).origin&&!u.pathname.startsWith('/api/'))return r.continue();
  if(u.pathname==='/api/schedule')return r.fulfill({json:{events:[],last_updated:'2026-09-09T00:00:00Z'}});
  if(u.pathname==='/api/announcements')return r.fulfill({json:{announcements:[]}});
  return r.abort();
 });
 const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base,{waitUntil:'domcontentloaded'});
 const countdown=p.getByText('IPM 2026 Starts In',{exact:true});await countdown.waitFor();await p.waitForTimeout(1000);
 const text=await p.locator('body').innerText();
 assert(!/Use IPM now|You’re already in IPM|Get important IPM updates|Notification options|IPM is on your Home Screen|Notification delivery|VERIFIED|MISMATCH|provider-ready|reconciliation|notification health/i.test(text));
 const box=await countdown.boundingBox();assert(box&&box.y<(width<720?500:800),`${name}: countdown top ${box?.y}`);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const invitation=p.getByText('Stay up to date',{exact:true});
 const expected=permission==='default'&&!dismissed;
 if(expected){await invitation.waitFor();assert((await invitation.boundingBox()).y>(await countdown.boundingBox()).y);await p.getByRole('button',{name:'Dismiss notification invitation'}).click();await p.reload();await countdown.waitFor();await p.waitForTimeout(300);assert.equal(await invitation.count(),0);}
 else assert.equal(await invitation.count(),0);
 assert.equal(await p.evaluate(()=>window.__permissionRequests),0);
 await p.screenshot({path:`/tmp/ipm-home-${name.replaceAll(' ','-')}.png`});
 await p.goto(base+'/schedule',{waitUntil:'domcontentloaded'});await p.getByText('Schedule',{exact:true}).first().waitFor();
 await p.goto(base,{waitUntil:'domcontentloaded'});await countdown.waitFor();assert.equal(await invitation.count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS',name,'countdown y',Math.round(box.y),'no setup wall, no install promotion, dismissal/navigation/permission safety');
 await c.close();
}
await browser.close();
