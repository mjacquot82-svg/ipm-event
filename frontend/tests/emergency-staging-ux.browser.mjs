import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.IPM_TEST_URL||'http://localhost:8101';
const out=process.env.IPM_ARTIFACT_DIR||'/tmp/ipm-emergency-staging-ux';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const results=[];
try {
for(const width of [320,390,1440]) {
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
 await context.addInitScript(()=>{
  window.__gps=0;
  navigator.geolocation.getCurrentPosition=(ok)=>{window.__gps++;ok({coords:{latitude:51.521251,longitude:-0.203586}});};
 });
 const urls=[],logs=[],bodies=[];let calls=0;
 await context.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());urls.push(r.url());
  if(u.pathname==='/api/what3words') {
   calls++;assert.equal(r.method(),'POST');assert.equal(u.search,'');
   assert.deepEqual(r.postDataJSON(),{lat:51.521251,lng:-0.203586});
   assert(!Object.keys(r.headers()).some(k=>/api.key|authorization/i.test(k)));
   return route.fulfill({json:{words:'filled.count.soap',nearestPlace:'London'},headers:{'cache-control':'no-store'}});
  }
  bodies.push(r.postData()||'');
  if(r.method()!=='GET')return route.abort();
  if(u.pathname==='/api/schedule')return route.fulfill({json:{events:[],last_updated:'2026-09-09T00:00:00Z'}});
  if(u.pathname==='/api/announcements')return route.fulfill({json:{announcements:[]}});
  return u.origin===new URL(base).origin?route.continue():route.abort();
 });
 const p=await context.newPage();p.on('console',m=>logs.push(m.text()));p.on('pageerror',e=>logs.push(e.message));
 await p.goto(base);await p.getByText('IPM 2026 Starts In',{exact:true}).waitFor();
 const emergency=p.getByRole('button',{name:'Emergency Services',exact:true});
 await emergency.waitFor();await p.getByRole('button',{name:'Share IPM',exact:true}).waitFor();
 assert.equal(await p.evaluate(()=>window.__gps),0);assert.equal(calls,0);
 const cards=await emergency.evaluate(el=>Array.from(el.parentElement.children,card=>card.textContent));
 assert(cards[0].includes('Emergency Services'));assert(cards[1].includes('Map'));assert(cards.at(-1).includes('Share IPM'));
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.screenshot({path:`${out}/home-${width}.png`,fullPage:true});
 await emergency.focus();await p.keyboard.press('Enter');
 const action=p.getByRole('button',{name:'Get my 3-word location',exact:true});await action.waitFor();
 await p.getByRole('heading',{name:'Emergency Services',exact:true}).waitFor();
 for(const s of ['Call 911 first','If this is an emergency, call 911 now. Then use your 3-word location below so the dispatcher can find you on site.',
 'Site 911 address','95 Durham Road','Entrances 9 & 10','Need help finding your location?',
 'Tap “Get my 3-word location” below. If prompted, allow location access so we can determine your 3-word location to share with the 911 dispatcher.',
 'Your browser may ask for location permission.']) await p.getByText(s,{exact:true}).waitFor();
 assert.equal(await p.evaluate(()=>window.__gps),0);assert.equal(calls,0);
 const aria=await p.locator('body').ariaSnapshot();
 assert(aria.includes('Get my 3-word location'));assert(aria.includes('Back to attendee Home'));
 writeFileSync(`${out}/emergency-${width}.aria.txt`,aria);
 await p.screenshot({path:`${out}/emergency-${width}.png`,fullPage:true});
 await action.focus();await p.keyboard.press('Enter');
 await p.getByText('Read this to 911',{exact:true}).waitFor();
 await p.getByText('///filled.count.soap',{exact:true}).waitFor();await p.getByText('Near London',{exact:true}).waitFor();
 assert.equal(calls,1);assert((await p.evaluate(()=>window.__gps))>=1);
 const store=await p.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage},url:location.href}));
 for(const canary of ['51.521251','-0.203586','filled.count.soap','synthetic-secret-canary-not-a-real-key']) {
  assert(!store.includes(canary));assert(!urls.join('\n').includes(canary));assert(!logs.join('\n').includes(canary));assert(!bodies.join('\n').includes(canary));
 }
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.screenshot({path:`${out}/success-${width}.png`,fullPage:true});
 await p.getByRole('button',{name:'Back to attendee Home',exact:true}).click();await emergency.waitFor();
 results.push({width,home:true,exact_copy:true,keyboard:true,screen_reader:true,explicit_gps:true,post_body:true,privacy:true});
 console.log('PASS exact staging Home action, page copy, keyboard, screen reader, explicit GPS and POST privacy',width);
 await context.close();
}
} finally {await browser.close();}
writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
