// Desktop geometry, interaction and persistent-host regression. No remote writes.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('/tmp/ipm-browser-tools/node_modules/playwright');
const origin=process.env.IPM_PREVIEW_URL||'http://127.0.0.1:8827';
const files={grounds:'grounds-site-map',tented:'tented-city-map-app-ready',rv:'rv-park-detail-map'};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const records=[];try{
 const c=await b.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 await c.route('**/*',r=>r.request().method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
 const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const ready=async mode=>p.waitForFunction(({mode,file})=>!document.querySelector(`[data-testid="map-artwork-${mode}-loading"]`)&&!document.querySelector(`[data-testid="map-artwork-${mode}-error"]`)&&document.querySelector(`img[src*="${file}"]`)?.complete,{mode,file:files[mode]});
 await p.goto(origin+'/map');await ready('grounds');await ready('tented');
 await p.evaluate(()=>window.preservedTC=document.querySelector('[data-testid="booth-divider"]'));
 for(const width of [768,1024,1280,1366,1440,1600,1920,2560])for(const height of [720,768,900,1080,1440]){
  await p.setViewportSize({width,height});
  for(const mode of ['grounds','tented','rv']){
   await p.getByTestId('map-mode-'+mode).click();await ready(mode);await p.waitForTimeout(80);
   const result=await p.evaluate(({mode,file})=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
    const img=document.querySelector(`img[src*="${file}"]`),sel=document.querySelector('[data-testid="map-mode-selector"]');
    const input=mode==='grounds'?document.querySelector('[data-testid="grounds-map-search"]'):mode==='rv'?document.querySelector('[data-testid="rv-site-search"]'):Array.from(document.querySelectorAll('input')).find(e=>e.placeholder==='Find a vendor, booth, stage, or place'&&e.getBoundingClientRect().width>0);
    const fit=mode==='grounds'?document.querySelector('[data-testid="grounds-fit-reset"]'):mode==='rv'?document.querySelector('[data-testid="rv-map-fit-reset"]'):Array.from(document.querySelectorAll('[aria-label="Reset map zoom"]')).find(e=>{for(let n=e;n;n=n.parentElement)if(getComputedStyle(n).opacity==='0')return false;return true});
    const f=fit.getBoundingClientRect(),hit=document.elementFromPoint(f.x+f.width/2,f.y+f.height/2);
    let viewport=img;while(viewport&&getComputedStyle(viewport).top!==(mode==='tented'?'164px':'120px'))viewport=viewport.parentElement;
    return {image:rect(img),selector:rect(sel),search:rect(input.parentElement),fit:rect(fit),viewport:rect(viewport),fitHit:fit===hit||fit.contains(hit),overflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,tcSame:window.preservedTC===document.querySelector('[data-testid="booth-divider"]'),dividers:document.querySelectorAll('[data-testid="booth-divider"]').length,natural:img.naturalWidth/img.naturalHeight};
   },{mode,file:files[mode]});
   const {image:i,selector:s,search:q,fit:f,viewport:v}=result;
   assert.ok(!result.overflow&&result.fitHit&&result.tcSame&&result.dividers===284,JSON.stringify({width,height,mode,result}));
   assert.ok(Math.abs(s.x-q.x)<1&&Math.abs(s.width-q.width)<1&&Math.abs(s.x-v.x)<1&&Math.abs(s.width-v.width)<1);
   assert.ok(i.x>=v.x-1&&i.y>=v.y-1&&i.x+i.width<=v.x+v.width+1&&i.y+i.height<=v.y+v.height+1);
   assert.ok(q.y>=s.y+s.height&&v.y>=q.y+q.height&&f.y>=v.y+v.height-1&&f.y+f.height<=height-76);
   assert.ok(Math.abs(i.width/i.height-result.natural)<0.003);
   assert.ok(Math.abs(i.x+i.width/2-width/2)<1);
   records.push({width,height,mode,...result});
  }
 }
 console.log('PASS 120 desktop map/viewport combinations: aligned, full aspect, no scrolling/overflow, Fit accessible, persistent 284-divider host');
 await p.setViewportSize({width:1440,height:900});
 for(const mode of ['grounds','tented','rv']){
  await p.getByTestId('map-mode-'+mode).click();await ready(mode);
  const fit=mode==='grounds'?p.getByTestId('grounds-fit-reset'):mode==='rv'?p.getByTestId('rv-map-fit-reset'):p.getByLabel('Reset map zoom',{exact:true}).first();
  await fit.click();const img=p.locator(`img[src*="${files[mode]}"]`),box=await img.boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
  await p.mouse.dblclick(x,y,{delay:100});
  await p.waitForFunction(file=>new DOMMatrix(getComputedStyle(document.querySelector(`img[src*="${file}"]`).closest('[style*="transform:"]')).transform).a>1.1,files[mode]);
  const transform=await img.evaluate(e=>e.closest('[style*="transform:"]').style.transform);
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x-50,y+30,{steps:8});await p.mouse.up();
  assert.notEqual(await img.evaluate(e=>e.closest('[style*="transform:"]').style.transform),transform);
  await fit.click();await p.waitForFunction(file=>new DOMMatrix(getComputedStyle(document.querySelector(`img[src*="${file}"]`).closest('[style*="transform:"]')).transform).a===1,files[mode]);
  console.log('PASS desktop double-click / pan / Fit',mode);
 }
 await p.getByTestId('rv-site-search').fill('M27');await p.getByText('RV Site M27',{exact:true}).click();await p.getByTestId('rv-site-highlight').waitFor();
 await p.goto(origin+'/map?mapType=tented&location=Ontario%20Government');await ready('tented');
 assert.deepEqual(await p.getByTestId('vendor-booth-highlight').evaluate(e=>({left:e.style.left,top:e.style.top,width:e.style.width,height:e.style.height,fill:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderColor})),{left:'37.754%',top:'52.744%',width:'4.548%',height:'3.947%',fill:'rgba(0, 229, 255, 0.45)',border:'rgb(255, 214, 0)'});
 assert.equal(await p.getByTestId('selected-parent-range-fill').count(),0);
 await p.goto(origin+'/map?mapType=tented&location=The%20Beyond%20Wireless%20Stage');await ready('tented');await p.getByTestId('selected-stage-highlight').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS desktop M27 / Ontario exact union / MNP / no runtime errors');
 fs.mkdirSync('../diagnostics/desktop-map-workspace',{recursive:true});fs.writeFileSync('../diagnostics/desktop-map-workspace/desktop-browser.json',JSON.stringify(records,null,2));
 await c.close();
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
