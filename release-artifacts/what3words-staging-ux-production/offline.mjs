import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const base=process.env.IPM_TEST_URL;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const c=await browser.newContext();
await c.route('**/*',r=>r.request().method()==='GET'&&new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
await c.addInitScript(()=>{
 window.__copied=[];window.__gps=0;
 Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__copied.push(text)}});
 navigator.geolocation.getCurrentPosition=ok=>{window.__gps++;ok({coords:{latitude:51.521251,longitude:-0.203586}});};
});
try {
 const p=await c.newPage();await p.goto(base);await p.getByText('IPM 2026 Starts In',{exact:true}).waitFor();
 await p.evaluate(async()=>{await navigator.serviceWorker.register('/webpushr-sw.js');await navigator.serviceWorker.ready;});
 await p.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 const keys=await p.evaluate(()=>caches.keys());assert(keys.some(k=>k.startsWith('ipm-offline-shell-')));
 await c.setOffline(true);await p.reload();await p.getByText('IPM 2026 Starts In',{exact:true}).waitFor();
 await p.getByRole('button',{name:'Share IPM',exact:true}).click();await p.getByText('IPM link copied',{exact:true}).waitFor();
 assert.deepEqual(await p.evaluate(()=>window.__copied),['https://theipm.ca']);
 await p.getByRole('button',{name:'Emergency Services',exact:true}).click();
 await p.getByText('Call 911 first',{exact:true}).waitFor();assert.equal(await p.evaluate(()=>window.__gps),0);
 await p.getByRole('button',{name:'Get my 3-word location',exact:true}).click();
 await p.getByText('Unable to get a 3-word location. Try again.',{exact:true}).waitFor();
 await p.reload();await p.getByText('Call 911 first',{exact:true}).waitFor();
 await p.goto(base+'/schedule');await p.getByText('Schedule',{exact:true}).first().waitFor();
 console.log('PASS actual service-worker offline Home, Share copy, Emergency access/deep-link/network fallback, Schedule',keys);
} finally {await browser.close();}
