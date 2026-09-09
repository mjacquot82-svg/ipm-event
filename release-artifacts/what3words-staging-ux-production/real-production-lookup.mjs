import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.IPM_TEST_URL||'https://theipm.ca';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
for(const width of [390])for(const scenario of ['success','denied','network']){
 const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',geolocation:{latitude:51.521251,longitude:-0.203586},permissions:['geolocation']});
 if(['denied','unavailable'].includes(scenario))await c.addInitScript(code=>{navigator.geolocation.getCurrentPosition=(_ok,fail)=>fail({code,message:'Synthetic GPS error'});},scenario==='denied'?1:2);
 const p=await c.newPage();const urls=[],logs=[];let calls=0;let liveStatus=null;
 p.on('response',r=>{if(new URL(r.url()).pathname==='/api/what3words'&&r.request().method()==='POST')liveStatus=r.status();});
 p.on('console',m=>logs.push(m.text()));p.on('pageerror',e=>logs.push(e.message));
 await p.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());urls.push(r.url());
  if(u.pathname==='/api/what3words'){
   if(r.method()==='OPTIONS')return route.continue();
   calls++;assert.equal(r.method(),'POST');assert.equal(u.search,'');
   assert.deepEqual(r.postDataJSON(),{lat:51.521251,lng:-0.203586});
   assert(!Object.keys(r.headers()).some(k=>k.toLowerCase()==='x-api-key'));
   if(scenario==='network')return route.abort();
   if(scenario==='provider')return route.fulfill({status:502,json:{detail:'Unable to convert location'}});
   if(scenario==='rate')return route.fulfill({status:429,json:{detail:'Please wait a minute before trying again'}});
   return route.continue(); // Real production browser-to-backend-to-provider conversion.
  }
  const otherBody=r.postData()||'';
  assert(!otherBody.includes('51.521251')&&!otherBody.includes('-0.203586')&&!otherBody.includes('filled.count.soap'),'Location leaked to another request/analytics');
  if(r.method()!=='GET')return route.abort();
  if(u.origin===new URL(base).origin)return route.continue();
  return route.abort();
 });
 await p.goto(base+'/emergency-services',{waitUntil:'domcontentloaded'});
 const action=p.getByRole('button',{name:'Get my 3-word location',exact:true});await action.waitFor();assert.equal(calls,0);
 await action.click();
 const expected={success:'Read this to 911',denied:'Location permission was denied. Allow location access, then try again.',unavailable:'Your device could not provide a location. Turn on location services and try again.',network:'Unable to get a 3-word location. Try again.',provider:'Location lookup failed. Try again.',rate:'Please wait a minute before trying again.'}[scenario];
 await p.getByText(expected,{exact:true}).waitFor();assert.equal(calls,['denied','unavailable'].includes(scenario)?0:1);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const storage=await p.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage},url:location.href}));
 for(const value of ['51.521251','-0.203586','filled.count.soap','synthetic-secret-canary-not-a-real-key']){
  assert(!storage.includes(value));assert(!urls.join('\n').includes(value));assert(!logs.join('\n').includes(value));
 }
 if(scenario==='success'){assert.equal(liveStatus,200);await p.screenshot({path:`/tmp/ipm-emergency-private-${width}.png`,fullPage:true});await p.reload();await action.waitFor();assert.equal(await p.getByText('Read this to 911',{exact:true}).count(),0);}
 console.log('PASS',width,scenario,scenario==='success'?'REAL production provider HTTP 200':'controlled error fixture','body-only POST, safe errors, no URL/log/storage leak, no automatic lookup');await c.close();
}
const c=await browser.newContext({serviceWorkers:'block'});const p=await c.newPage();await p.route('**/*',r=>r.request().method()==='GET'&&new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());await p.goto(base+'/about');await p.getByRole('button',{name:'Emergency Services / Need Help'}).click();await p.getByRole('button',{name:'Get my 3-word location',exact:true}).waitFor();console.log('PASS About entry and map-independent Emergency route');await browser.close();
