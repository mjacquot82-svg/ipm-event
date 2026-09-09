import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL||'http://localhost:8098';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const android='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
for (const [name,width,height,installed,permission,next] of [
 ['320 installed enabled',320,568,true,'granted',false],
 ['320 installed next',320,568,true,'granted',true],
 ['320 installed disabled',320,568,true,'default',false],
 ['360 installed disabled',360,640,true,'default',true],
 ['320 browser disabled',320,568,false,'default',false],
 ['360 browser enabled',360,640,false,'granted',true],
 ['360 browser denied',360,640,false,'denied',false],
 ['desktop',1440,900,false,'default',true],
]) { const ua=android,dismissed=false;
 const c=await browser.newContext({viewport:{width,height},userAgent:ua,serviceWorkers:'block'});
 await c.addInitScript(({installed,permission,dismissed,next})=>{
  window.__permissionRequests=0;if(next)localStorage.setItem('@event_navigator_favorites',JSON.stringify({sessionIds:['11111111-1111-4111-8111-111111111111']}));
  if(permission==='unsupported'){delete window.Notification;}else Object.defineProperty(window,'Notification',{configurable:true,value:{permission,requestPermission:async()=>{window.__permissionRequests++;return permission;}}});
  Object.defineProperty(navigator,'standalone',{configurable:true,value:installed});
  const match=window.matchMedia.bind(window);window.matchMedia=q=>q==='(display-mode: standalone)'?{...match(q),matches:installed,addEventListener(){},removeEventListener(){}}:match(q);
  if(dismissed)localStorage.setItem('@ipm_home_notification_invitation_dismissed_v1','true');
  const reg={update:async()=>{},pushManager:{getSubscription:async()=>null}};
  if(navigator.serviceWorker){navigator.serviceWorker.register=async()=>reg;navigator.serviceWorker.getRegistration=async()=>reg;}
  window.WonderPush={push(value){if(typeof value==='function')value();},isSubscribedToNotifications:async()=>permission==='granted',getInstallationId:async()=>'0123456789abcdef0123456789abcdef',getUserId:async()=>null};
 },{installed,permission,dismissed,next});
 await c.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(r.request().method()!=='GET')return r.abort();
  if(u.hostname==='cdn.by.wonderpush.com')return r.fulfill({contentType:'application/javascript',body:'/* inert SDK fixture; no provider requests */'});
  if(u.origin===new URL(base).origin&&!u.pathname.startsWith('/api/'))return r.continue();
  if(u.pathname==='/api/schedule')return r.fulfill({json:{events:[{id:'11111111-1111-4111-8111-111111111111',title:'Space fixture event',start_date:'2026-09-22',start_time:'10:00',category:'entertainment',location_name:'Fixture tent'}],last_updated:'2026-09-09T00:00:00Z'}});
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
 const invitation=p.getByLabel('Optional IPM updates',{exact:true});
 const primary=p.getByText(next?'My Next Event':'Quick Actions',{exact:true});await primary.waitFor();
 const primaryBox=await primary.boundingBox();
 const promptBox=await invitation.count()?await invitation.boundingBox():null;
 console.log(JSON.stringify({name,width,height,primaryY:primaryBox.y,primaryVisible:primaryBox.y<height-60,promptHeight:promptBox?.height||0,promptY:promptBox?.y||null}));
 assert(primaryBox.y<height-60,'Primary content should start above bottom navigation');
 await p.screenshot({path:process.env.IPM_ARTIFACT_DIR+'/before-'+name.replaceAll(' ','-')+'.png'});
 await c.close();
}
await browser.close();
