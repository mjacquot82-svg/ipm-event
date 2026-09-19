// Browser fixtures only: no provider calls, notification permissions or API writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.IPM_TEST_URL || 'http://127.0.0.1:8870';
const out = process.env.IPM_TEST_OUTPUT || '.artifacts/install-guidance/browser';
fs.mkdirSync(out, { recursive: true });
const schedule = JSON.parse(fs.readFileSync(new URL('./fixtures/map-education-schedule.json', import.meta.url)));
const catalog = JSON.parse(fs.readFileSync(new URL('../public/api/vendors.json', import.meta.url)));
const vendor = catalog.vendors.find(v => v.name === 'Ontario Government');
const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const desktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
const preserved = {'@event_navigator_favorites': JSON.stringify({sessionIds:['fixture-saved-session']}), '@ipm_notification_capability_v1':'fixture-preserve-only', 'pwa_notification_dismissed_at':'1234'};
const browser = await chromium.launch({args:['--no-sandbox']});
const errors = [];
async function setup({ua=android,width=390,display='',iosStandalone=false,oldChoice={},storageBlocked=false,referrer=''}={}) {
 const c = await browser.newContext({viewport:{width,height:width===320?568:780},userAgent:ua,serviceWorkers:'block'});
 await c.addInitScript(({display,iosStandalone,oldChoice,preserved,storageBlocked,referrer,ua})=>{
  const original=window.matchMedia.bind(window);
  window.matchMedia=q=>q.startsWith('(display-mode:')?{...original(q),matches:!!display&&q===`(display-mode: ${display})`,addEventListener(){},removeEventListener(){}}:original(q);
  Object.defineProperty(navigator,'standalone',{configurable:true,value:iosStandalone});
  if(ua.includes('Macintosh')){Object.defineProperty(navigator,'platform',{configurable:true,value:'MacIntel'});Object.defineProperty(navigator,'maxTouchPoints',{configurable:true,value:5});}
  if(referrer)Object.defineProperty(document,'referrer',{configurable:true,value:referrer});
  if(!sessionStorage.getItem('install-fixture-seeded')){
   for(const [k,v]of Object.entries({...preserved,...oldChoice}))localStorage.setItem(k,v);
   sessionStorage.setItem('install-fixture-seeded','true');
  }
  if(storageBlocked){const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k.startsWith('pwa_install_'))throw Error('fixture blocked');return get.call(this,k);};}
  window.__installCalls=0;window.__permissionCalls=0;
  if(window.Notification)Notification.requestPermission=async()=>{window.__permissionCalls++;return 'default';};
 },{display,iosStandalone,oldChoice,preserved,storageBlocked,referrer,ua});
 await c.route('**/*',r=>{
  const q=r.request(),u=new URL(q.url());
  if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':q.headers()['access-control-request-headers']||'content-type'}});
  if(q.method()!=='GET')return r.abort();
  const headers={'access-control-allow-origin':base,'access-control-allow-credentials':'true'};
  if(u.pathname==='/api/schedule')return r.fulfill({json:schedule,headers});
  if(u.pathname==='/api/vendors')return r.fulfill({json:{...catalog,vendors:[vendor]},headers});
  if(u.pathname.startsWith('/api/'))return r.fulfill({json:{announcements:[],events:[],vendors:[],total_count:0},headers});
  return u.origin===new URL(base).origin?r.continue():r.abort();
 });
 const p=await c.newPage();p.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});
 const dialog=p.getByRole('dialog',{name:'Install the IPM App',exact:true});
 const unchanged=async()=>{assert.deepEqual(await p.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(preserved)),preserved);assert.equal(await p.evaluate(()=>window.__permissionCalls),0);};
 return {c,p,dialog,unchanged};
}
async function noPrompt(p,dialog){if(new URL(p.url()).pathname==='/')await p.getByText('IPM 2026 Starts In',{exact:true}).waitFor();await p.waitForTimeout(800);assert.equal(await dialog.count(),0);}
async function fakeNative(p,outcome){await p.evaluate(outcome=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.__installCalls++;};e.userChoice=Promise.resolve({outcome});dispatchEvent(e);},outcome);}
try {
 for(const [name,ua,width]of [['android-small',android,320],['android',android,390],['iphone',ios,393],['ipad',ipad,768],['desktop',desktop,1440],['ambiguous','',390]]){
  const {c,p,dialog,unchanged}=await setup({ua,width});await p.goto(base+'/');await dialog.waitFor();
  assert.equal(await p.getByTestId('map-education-card').count(),0);
  if(name.startsWith('android'))await dialog.getByText('Tap the three dots',{exact:true}).waitFor();
  if(name==='iphone'||name==='ipad'){await dialog.getByText('Tap the Share button',{exact:true}).waitFor();await dialog.getByText('Tap “Add to Home Screen”',{exact:true}).waitFor();}
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const close=dialog.getByRole('button',{name:'Close install guidance'});const b=await close.boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=p.viewportSize().height&&b.height>=44);
  await p.screenshot({path:`${out}/${name}.png`});
  await close.focus();await p.keyboard.press('Tab');assert.ok(await p.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')));await unchanged();
  await dialog.getByRole('button',{name:'Continue without installing'}).click();await noPrompt(p,dialog);
  await p.reload();await noPrompt(p,dialog);await fakeNative(p,'dismissed');await noPrompt(p,dialog);
  await p.goto(base+'/about');await p.getByRole('button',{name:'Install App',exact:true}).click();await p.getByRole('heading',{name:'Install the IPM App',exact:true}).waitFor();
  await p.getByRole('button',{name:'Close install guidance'}).click();await unchanged();await c.close();
  console.log(`PASS ${name} ${width}: auto guidance, dismissal/reload, manual replay, layout and preserved state`);
 }
 for(const outcome of ['accepted','dismissed']){
  const {c,p,dialog,unchanged}=await setup();await p.goto(base+'/');await dialog.waitFor();await fakeNative(p,outcome);
  const action=dialog.getByRole('button',{name:'Install App',exact:true});await action.waitFor();assert.equal(await p.evaluate(()=>window.__installCalls),0);
  await action.click();await noPrompt(p,dialog);assert.equal(await p.evaluate(()=>window.__installCalls),1);await unchanged();await p.reload();await noPrompt(p,dialog);await c.close();
  console.log(`PASS native prompt: user gesture only, ${outcome}, no repeat`);
 }
 for(const options of [{display:'standalone'},{display:'minimal-ui'},{ua:ios,iosStandalone:true},{oldChoice:{pwa_install_dismissed_at:'1'}},{oldChoice:{pwa_install_entry_completed:'true'}},{oldChoice:{pwa_install_installed:'true'}},{storageBlocked:true}]){
  const {c,p,dialog,unchanged}=await setup(options);await p.goto(base+'/');await noPrompt(p,dialog);await unchanged();await c.close();
 }
 {const {c,p,dialog}=await setup({referrer:'android-app://unrelated-messenger'});await p.goto(base+'/');await dialog.waitFor();await p.evaluate(()=>dispatchEvent(new Event('appinstalled')));await noPrompt(p,dialog);assert.equal(await p.evaluate(()=>localStorage.getItem('pwa_install_installed')),'true');await c.close();}
 console.log('PASS installed modes, old choices, storage failure, appinstalled and non-install Android referrer');
 for(const section of ['schedule','vendors','map']){
  const {c,p,dialog,unchanged}=await setup();await p.goto(base+'/');await dialog.waitFor();await dialog.getByRole('button',{name:'Close install guidance'}).focus();await p.keyboard.press('Escape');await noPrompt(p,dialog);
  await p.getByText(section==='map'?'Map':section==='schedule'?'Schedule':'Vendors',{exact:true}).last().click();
  if(section==='schedule')await p.getByText('Plan your day',{exact:true}).waitFor();else await p.getByTestId('map-education-card').waitFor();
  assert.equal(await dialog.count(),0);await unchanged();await c.close();
  // A direct deep link never mounts the automatic Home prompt or changes its route.
  const fresh=await setup();await fresh.p.goto(base+'/'+section);
  if(section==='schedule')await fresh.p.getByText('Plan your day',{exact:true}).waitFor();else await fresh.p.getByTestId('map-education-card').waitFor();
  assert.equal(await fresh.dialog.count(),0);assert.equal(new URL(fresh.p.url()).pathname,'/'+section);await fresh.c.close();
  console.log(`PASS ${section}: Home guidance then tutorial; direct deep link retains tutorial precedence`);
 }
 assert.deepEqual(errors,[]);console.log('PASS all browser scenarios; provider and API mutations blocked');
} finally {await browser.close();}
