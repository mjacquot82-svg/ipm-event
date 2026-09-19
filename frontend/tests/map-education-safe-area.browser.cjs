const assert=require('node:assert/strict');const{chromium,webkit}=require(process.env.IPM_PLAYWRIGHT_MODULE||'/tmp/ipm-browser-tools/node_modules/playwright');
const origin=process.env.IPM_PREVIEW_URL||'http://127.0.0.1:8870';
const intersect=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
(async()=>{for(const engine of (process.env.IPM_BROWSER==='webkit'?[webkit]:process.env.IPM_BROWSER==='chromium'?[chromium]:[chromium,webkit])){const b=await engine.launch({args:engine===chromium?['--no-sandbox']:[]});try{
 for(const width of (process.env.IPM_TEST_WIDTHS ? process.env.IPM_TEST_WIDTHS.split(',').map(Number) : [320,360,375,390,393,412,430,768,1024,1280,1366,1440,1600,1920,2560])){
 const phone=width<768, inset=phone?59:0;const c=await b.newContext({viewport:{width,height:width===320?640:900},isMobile:phone,hasTouch:phone,serviceWorkers:'block',reducedMotion:'reduce'});
 await c.route('**/*',r=>r.request().method()!=='GET'||/wonderpush|webpushr|google-analytics|onrender/.test(r.request().url())?r.abort():r.continue());
 await c.addInitScript(inset=>{const original=window.getComputedStyle;window.getComputedStyle=function(e,...args){const s=original.call(this,e,...args);return e.style.paddingTop.includes('safe-area-inset-top')?new Proxy(s,{get(t,k){if(k==='paddingTop')return inset+'px';if(k==='paddingBottom')return (inset?34:0)+'px';const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v;}}):s;};},inset);
 const p=await c.newPage();await p.goto(origin+'/map');const card=p.getByTestId('map-education-card');
 for(let i=0;i<5;i++){await card.waitFor();await p.waitForTimeout(300);const r=await card.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width&&r.y>=inset&&r.y+r.height<=p.viewportSize().height-(phone?34:0));const button=card.getByRole('button',{name:i===4?'Got it':'Next',exact:true});await button.click();}
 for(const mode of ['grounds','tented','rv','entrances']){await p.getByTestId('map-mode-'+mode).click();await p.waitForTimeout(250);if(mode==='grounds')await p.getByTestId('grounds-map-search').fill('ACE');if(mode==='tented')await p.getByPlaceholder('Find a vendor, booth, stage, or place').fill('ACE');if(mode==='rv')await p.getByTestId('rv-site-search').fill('M27');const help=p.getByRole('button',{name:'Map Help, replay Maps tour'}),h=await help.boundingBox();assert.ok(h.x>=0&&h.x+h.width<=width&&h.y>=inset,JSON.stringify({mode,width,inset,h}));assert.ok(await help.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit)}),'Help hit target');
 const fit=mode==='grounds'?p.getByTestId('grounds-fit-reset'):mode==='rv'?p.getByTestId('rv-map-fit-reset'):mode==='entrances'?p.getByLabel('Fit entrances and parking map',{exact:true}):p.getByLabel('Reset map zoom',{exact:true}).first();
 assert.ok(!intersect(h,await fit.boundingBox()),'Help must not collide with Fit '+mode+'/'+width);assert.ok(!intersect(h,await p.getByTestId('map-mode-selector').boundingBox()),'Help clear of selector');
 }
 await c.close(); console.log('PASS width',engine.name(),width);
 }
 console.log('PASS '+engine.name()+' requested widths, all five steps, 59px top/34px bottom safe areas, short phone, Help hit targets and Fit/selector separation across all four maps');
}finally{await b.close();}}})().catch(e=>{console.error(e);process.exitCode=1;});
