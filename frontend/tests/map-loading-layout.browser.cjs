// Simulated viewport/insets: this does not replace physical iPhone approval.
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.IPM_PLAYWRIGHT_MODULE||'/tmp/ipm-browser-tools/node_modules/playwright');
const origin=process.env.IPM_PREVIEW_URL||'http://127.0.0.1:8797';
const engine=process.env.IPM_BROWSER==='webkit'?webkit:chromium;
(async()=>{const browser=await engine.launch({headless:true,args:engine===chromium?['--no-sandbox']:[]});try{
 for(const width of (process.env.IPM_WIDTHS ? process.env.IPM_WIDTHS.split(',').map(Number) : [320,375,390,393,430,360,412])) {
  const inset=width>=768||[360,412].includes(width)?0:59;
  const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await c.route('**/*',r=>r.request().method()!=='GET'||/wonderpush|webpushr|google-analytics|ipm-(?:staging-)?backend/.test(r.request().url())?r.abort():r.continue());
  await c.addInitScript(inset=>{
   const original=window.getComputedStyle;
   window.getComputedStyle=function(el,...rest){const computed=original.call(this,el,...rest);if(el.style.paddingTop.includes('safe-area-inset-top'))return new Proxy(computed,{get(target,key){if(key==='paddingTop')return inset+'px';const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});return computed;};
   const decode=HTMLImageElement.prototype.decode;
   HTMLImageElement.prototype.decode=function(){return /grounds-site-map|tented-city-map-app-ready|rv-park-detail-map/.test(this.src)?new Promise(()=>{}):decode.call(this);};
  },inset);
  const p=await c.newPage();await p.goto(origin+'/map',{waitUntil:'domcontentloaded'});
  for(const mode of ['grounds','tented','rv']) {
   const tab=p.getByTestId('map-mode-'+mode);await tab.click();
   const loading=p.getByTestId('map-artwork-'+mode+'-loading');await loading.waitFor();
   const label=loading.getByText('Loading map…',{exact:true});const box=await label.boundingBox();
   assert.ok(box&&box.x>=0&&box.x+box.width<=width&&box.y>=inset&&box.y+box.height<=900,JSON.stringify(box));
   assert.ok(await label.evaluate(el=>{const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return hit===el||el.contains(hit)}),'loading text unclipped');
   const search=mode==='grounds'?p.getByTestId('grounds-map-search'):mode==='rv'?p.getByTestId('rv-site-search'):p.getByPlaceholder('Find a vendor, booth, stage, or place').filter({visible:true});
   await search.fill('M27');await search.fill('');const sb=await search.boundingBox(),tb=await tab.boundingBox();
   assert.ok(tb.y>=inset+8&&sb.y>=tb.y+tb.height&&box.y>=sb.y+sb.height);
   assert.ok(await p.getByTestId('map-mode-selector').isVisible());
  }
  console.log('PASS loading text / selector / usable search / safe inset',engine.name(),width,inset);await c.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
