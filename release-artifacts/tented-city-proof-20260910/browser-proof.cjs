// Run against a real exported app: IPM_PROOF_URL=http://127.0.0.1:4173 node browser-proof.cjs
// PLAYWRIGHT_MODULE may point to an installed Playwright module. External requests are blocked.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const base=process.env.IPM_PROOF_URL||'http://127.0.0.1:4173';
const out=process.env.IPM_PROOF_OUTPUT||__dirname;
fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
const rows=[],errors=[],blocked=[],measurements=[];
const vendors=[['ACE','ACE / JCB, Harriston','1A-09','1A 1-12'],['GGS Structures','GGS Structures Inc., Vineland Station','2B-23','2B 13-24'],['Kodiak Boots','Kodiak Boots, Cambridge','2B-06','2B 1-12'],['Hip Town Hype','Hip Town Hype, Trent Lakes','4A-14','4A 13-24'],['StumpedIt','StumpedIt, Clinton','5A-33','5A 25-38'],['Harkness Equipment','Harkness Equipment, Harriston','1B-15','1B 13-24']];
(async()=>{
 const browser=await chromium.launch({headless:true});
 const version=browser.version();
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1440,height:900}]){
  const mobile=viewport.width<500;
  const ctx=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1,serviceWorkers:'block'});
  await ctx.route('**/*',r=>{const req=r.request(),u=new URL(req.url());if(u.origin!==new URL(base).origin||!['GET','HEAD'].includes(req.method())||u.pathname.startsWith('/api/')){blocked.push({width:viewport.width,method:req.method(),origin:u.origin,path:u.pathname});return r.abort()}return r.continue()});
  const page=await ctx.newPage(); page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push({width:viewport.width,message:e.message}));
  const act=loc=>mobile?loc.tap():loc.click();
  const settle=()=>page.waitForTimeout(450);
  const input=page.getByPlaceholder('Find a vendor, booth, or stage');
  const boothLoc=label=>page.getByRole('button',{name:'Select booth '+label,exact:true});
  const parentLoc=label=>page.getByRole('button',{name:'Select '+label,exact:true});
  const clear=async()=>{if(await page.getByLabel('Clear search',{exact:true}).count())await act(page.getByLabel('Clear search',{exact:true}));else await act(page.getByLabel('Reset map zoom'));await settle()};
  const shot=async name=>page.screenshot({path:path.join(out,'screenshots',viewport.width+'-'+name+'.png')});
  async function check(name,fn){try{const evidence=await fn();rows.push({width:viewport.width,name,status:'PASS',evidence});console.log('PASS',viewport.width,name)}catch(e){rows.push({width:viewport.width,name,status:'FAIL',error:e.message});console.log('FAIL',viewport.width,name,e.message);await shot('FAIL-'+name.replace(/[^a-z0-9-]/gi,'-')).catch(()=>{})}}
  async function state(label){const value=await boothLoc(label).evaluate(el=>{
   const r=el.getBoundingClientRect(),s=getComputedStyle(el),layer=el.parentElement,lr=layer.getBoundingClientRect(),matrix=new DOMMatrix(getComputedStyle(layer).transform),cx=r.x+r.width/2,cy=r.y+r.height/2,hit=document.elementFromPoint(cx,cy);
   const rect={x:r.x,y:r.y,w:r.width,h:r.height};
   const expectedWidth=parseFloat(el.style.width)/100*lr.width;const intendedHit=document.elementFromPoint(r.x+expectedWidth/2,cy);
   return {activeBooths:[...layer.querySelectorAll('[aria-label^=\"Select booth \"]')].filter(n=>getComputedStyle(n).borderTopWidth==='3px').map(n=>n.ariaLabel),label:el.ariaLabel,rect,expectedWidth,border:s.borderTopWidth,background:s.backgroundColor,scale:matrix.a,tx:matrix.e,ty:matrix.f,centerVisible:intendedHit===el||el.contains(intendedHit),paintedCenterHit:hit?.getAttribute('aria-label'),hit:hit?.getAttribute('aria-label')||hit?.textContent?.slice(0,80),overflow:document.documentElement.scrollWidth>innerWidth+1,cssLeft:el.style.left,cssTop:el.style.top,cssWidth:el.style.width};
  });measurements.push({width:viewport.width,...value});return value}
  const camera=()=>parentLoc('1A 1-12').evaluate(el=>{const m=new DOMMatrix(getComputedStyle(el.parentElement).transform);return {scale:m.a,tx:m.e,ty:m.f}});
  const seedHarkness=async()=>{await input.fill('Harkness Equipment');await act(page.getByText('Harkness Equipment, Harriston',{exact:true}).first());await settle()};
  function selected(s){assert.equal(s.border,'1px');assert.equal(s.background,'rgba(166, 38, 45, 0.24)');assert(Math.abs(s.rect.w-s.expectedWidth)<1,'Highlight escaped booth geometry');assert(s.scale>1);assert(!s.overflow);assert(s.centerVisible,'Highlight center occluded by '+s.hit);assert(s.rect.x>=0&&s.rect.x+s.rect.w<=viewport.width,'highlight outside width');assert(Math.abs(s.rect.x+s.expectedWidth/2-viewport.width/2)<2,'booth geometry not centered horizontally');}
  await page.goto(base+'/map?source=vendors');await input.waitFor();await settle();
  await check('initial-svg-and-overflow',async()=>{const imgs=await page.locator('img').evaluateAll(es=>es.filter(e=>e.src.includes('tented-city-map-app-ready')).map(e=>({src:new URL(e.src).pathname,complete:e.complete,w:e.naturalWidth,h:e.naturalHeight})));assert(imgs.some(i=>i.complete&&i.w>0&&i.h>0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('initial');return imgs});
  for(const [query,name,booth,parent] of vendors){
   await check('vendor-'+booth,async()=>{await input.fill(query);await act(page.getByText(name,{exact:true}));await settle();const s=await state(booth);const p=await parentLoc(parent).evaluate(el=>({label:el.ariaLabel,border:getComputedStyle(el).borderTopWidth}));assert.equal(p.border,'3px');assert.equal(await input.inputValue(),name);assert(await page.getByText(booth,{exact:true}).count());selected(s);await shot('vendor-'+booth);return {query,selectedVendor:name,normalizedBooth:booth,individualId:'booth-'+booth.toLowerCase(),parentId:'range-'+parent.replace(' ','-'),parent:p,...s}});
   await check('exact-painted-width-'+booth,async()=>{const s=await state(booth);assert(Math.abs(s.rect.w-s.expectedWidth)<1,`Painted booth width ${s.rect.w.toFixed(2)}px exceeds cell width ${s.expectedWidth.toFixed(2)}px`);return s});
  }
  await check('pan-after-autozoom',async()=>{await seedHarkness();const before=await camera();await page.mouse.move(viewport.width/2,viewport.height*0.46);await page.mouse.down();await page.mouse.move(viewport.width/2+45,viewport.height*0.46+35,{steps:10});await page.mouse.up();await settle();const after=await camera();assert(Math.abs(after.tx-before.tx)>20);assert(Math.abs(after.ty-before.ty)>20);assert.equal(after.scale,before.scale);await shot('panned');return {before,after,input:'mouse/pointer drag (touch pan separately recorded)'}});
  if(mobile)await check('touch-pan-after-autozoom',async()=>{await seedHarkness();const before=await camera();const cdp=await ctx.newCDPSession(page);const x=viewport.width/2,y=viewport.height*0.46;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+i*6,y:y+i*5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();const after=await camera();assert(Math.abs(after.tx-before.tx)>20);assert.equal(after.scale,before.scale);return {before,after}});
  await check('reset',async()=>{await act(page.getByLabel('Reset map zoom'));await settle();const s=await camera();assert.equal(s.scale,1);assert.equal(s.tx,0);assert.equal(s.ty,0);await shot('reset');return s});
  for(const [parent,booths] of [['1A 1-12',['1A-01','1A-06','1A-12']],['4A 25-38',['4A-25','4A-31','4A-38']],['5A 39-44',['5A-39','5A-41','5A-44']],['5A 5-12',['5A-05','5A-08','5A-12']]]){
   await check('range-'+parent,async()=>{await clear();await act(parentLoc(parent));await settle();return {parent,individualRegions:await page.locator('[aria-label^="Select booth "]').count()}});
   for(const booth of booths)await check('tap-'+booth,async()=>{await act(boothLoc(booth));await settle();const s=await state(booth);selected(s);assert.equal(await input.inputValue(),booth);await shot('tap-'+booth);return s});
  }
  for(const query of ['1A--oops','9Z-999','6B-26'])await check('lookup-'+query,async()=>{await clear();await input.fill(query);await page.getByText('No matching places on this map.',{exact:true}).waitFor();await input.press('Enter');assert.equal(await page.locator('[aria-label^="Select booth "]').count(),0);await shot('lookup-'+query);return {query,result:'No matching places on this map.',note:query==='6B-26'?'No matching vendor or semantic parent in current app; parent fallback cannot be proved for this range.':undefined}});
  for(const [query,name,parent] of [['Quilt Jeannie','The Quilt Jeannie, Harriston','QUILT TENT 3A 39-44 ? G2'],['Avenir Energy','Avenir Energy, Flesherton','RURAL EXPO COURTYARD 3B 39-44']])await check('orientation-unverified-'+query,async()=>{await clear();await input.fill(query);await act(page.getByText(name,{exact:true}));await settle();assert.equal(await page.locator('[aria-label^="Select booth "]').count(),0);const s=await parentLoc(parent).evaluate(e=>{const r=e.getBoundingClientRect();const fp=[...e.parentElement.children].filter(n=>getComputedStyle(n).borderTopWidth==='4px').map(n=>({left:n.style.left,top:n.style.top,width:n.style.width,rect:n.getBoundingClientRect().toJSON()}));const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:e.ariaLabel,semanticBorder:getComputedStyle(e).borderTopWidth,rect:r.toJSON(),expectedLeft:e.style.left,expectedTop:e.style.top,footprints:fp,centerVisible:hit===e||e.contains(hit)}});assert.equal(s.footprints.length,1);assert(Math.abs(parseFloat(s.footprints[0].left)-parseFloat(s.expectedLeft))<0.01);assert(Math.abs(parseFloat(s.footprints[0].top)-parseFloat(s.expectedTop))<0.01);assert(s.centerVisible,'Fallback covered by UI');await shot('fallback-'+query.replaceAll(' ','-'));return s});
  await check('final-svg-and-overflow',async()=>{assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await page.locator('img').evaluateAll(es=>es.some(e=>e.src.includes('tented-city-map-app-ready')&&e.complete&&e.naturalWidth>0)));return {blankSVG:false,horizontalOverflow:false}});
  await ctx.close();
 }
 await browser.close();
 const result={base,version,sourceSHA:'35df71f0b4c5ddd1ab276165b84ec9197e2c8fb9',networkPolicy:'Only same-origin static GET/HEAD; APIs and all external requests aborted. Actual bundled map/vendor data, no map/vendor mocks.',pinch:'PHYSICAL TEST REQUIRED',rows,measurements,pageErrors:errors,blockedRequests:blocked};
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({pass:rows.filter(r=>r.status==='PASS').length,fail:rows.filter(r=>r.status==='FAIL').length,pageErrors:errors.length}));
})().catch(e=>{console.error(e);process.exitCode=1});
