// Real public Vendor data; manual replay after completion. No preview, test-side scrolling or server writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const modules=new Map();
function load(url){
 if(modules.has(url.href))return modules.get(url.href).exports;
 const mod={exports:{}};modules.set(url.href,mod);
 const code=ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',code)(name=>name.endsWith('.json')?JSON.parse(fs.readFileSync(new URL(name,url))):load(new URL(name+'.ts',url)),mod,mod.exports);return mod.exports;
}
const {resolveVendorMapQuery}=load(new URL('../src/config/vendorMapCrosswalk.ts',import.meta.url));
import { assertClickCue, assertNoClickCue } from './tutorial-click-cue-assertions.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.IPM_TEST_URL || 'https://staging.theipm.ca';
const out = process.env.IPM_TEST_OUTPUT || '.artifacts/vendor-interactive/browser';fs.mkdirSync(out,{recursive:true});
const browser = await chromium.launch();let p;
try {for(const [width,height] of (process.env.IPM_TEST_VIEWPORTS ? JSON.parse(process.env.IPM_TEST_VIEWPORTS) : [[320,568],[390,844],[768,1024],[1440,900]])) {
 const c=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
 await c.route('**/*',r=>!['GET','OPTIONS'].includes(r.request().method())||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
 p=await c.newPage();await p.goto(base+'/vendors');
 await p.evaluate(()=>{for(const key of ['@ipm_vendor_find_on_map_tip_seen_v1','@ipm_maps_tour_seen_v1','@ipm_schedule_itinerary_onboarding_v1'])localStorage.setItem(key,'true');});
 await p.reload();const help=p.getByRole('button',{name:'Vendors Help',exact:true}),tip=p.getByTestId('map-education-card');
 async function noAuto(){await help.waitFor();await p.waitForTimeout(700);assert.equal(await tip.count(),0);await assertNoClickCue(p);}
 async function flow(label,manual=true){
  if(manual)await help.click();
  await tip.getByText('Find this vendor',{exact:true}).waitFor();
  assert.match(await tip.innerText(),/Tap Find on Map to see where this vendor is located/);
  assert.equal(await tip.getByRole('button',{name:/Got it|Next/}).count(),0);
  await assertClickCue(p,'vendor-education-open-map');
  // Move the actual list while waiting; measurement must keep the cue attached.
  await p.getByTestId('vendor-find-on-map').first().evaluate(button=>{
   for(let parent=button.parentElement;parent;parent=parent.parentElement){
    if(parent.scrollHeight>parent.clientHeight+50&&/auto|scroll/.test(getComputedStyle(parent).overflowY)){parent.scrollTop+=24;break;}
   }
  });
  await p.waitForTimeout(600);await assertClickCue(p,'vendor-education-open-map');
  const target=p.getByTestId('vendor-education-open-map'),rect=await target.boundingBox();
  const vendor=await p.getByTestId('vendor-find-on-map').evaluateAll((buttons,r)=>{
   const button=buttons.find(e=>{const b=e.getBoundingClientRect();return Math.abs(b.x-r.x)<2&&Math.abs(b.y-r.y)<2&&Math.abs(b.width-r.width)<2&&Math.abs(b.height-r.height)<2;});
   return button?.parentElement?.firstElementChild?.textContent;
  },rect);
  assert(vendor,'spotlight exactly matches a real Find on Map button');
  await p.mouse.click(2,2);await p.waitForTimeout(200);await tip.getByText('Find this vendor',{exact:true}).waitFor();
  const cue=await p.getByTestId('tutorial-click-cue').boundingBox();await p.mouse.click(cue.x+cue.width/2,cue.y+cue.height/2);await tip.getByText('Find this vendor',{exact:true}).waitFor();
  await p.screenshot({path:`${out}/${width}-${label}-target.png`});
  // Touch the center of the real Find on Map bounds. The shared transparent target invokes its same handler.
  await p.touchscreen.tap(rect.x+rect.width/2,rect.y+rect.height/2);
  await p.waitForURL(/\/map\?/);await tip.getByText('Vendor location',{exact:true}).waitFor();await assertNoClickCue(p);
  const url=new URL(p.url()),location=url.searchParams.get('location');assert.equal(url.searchParams.get('source'),'vendors');assert.equal(url.searchParams.get('mapType'),'tented');assert(location);assert.equal(location,resolveVendorMapQuery(vendor).query,'map destination matches the highlighted vendor through the approved crosswalk');
  await p.waitForFunction(name=>document.querySelector('[data-testid=map-selection-title]')?.textContent===name,location);
  await p.getByTestId('vendor-booth-highlight').first().waitFor();
  assert((await tip.innerText()).includes(location));assert.doesNotMatch(await tip.innerText(),/1 of 5|Find parking/);
  assert.doesNotMatch(await p.getByTestId('map-selection-card').innerText(),/Previous event|10:00|10:15/);
  await p.screenshot({path:`${out}/${width}-${label}-map.png`});
  await tip.getByRole('button',{name:'Got it',exact:true}).click();
  await p.waitForFunction(()=>!new URL(location.href).searchParams.has('vendorWalkthrough'));
  assert.equal(await p.getByTestId('map-selection-title').innerText(),location);await p.getByTestId('vendor-booth-highlight').first().waitFor();assert.equal(await tip.count(),0);
  assert.equal(await p.evaluate(()=>localStorage.getItem('@ipm_vendor_find_on_map_tip_seen_v1')),'true');
  return location;
 }
 await noAuto();
 // Preserve the mounted Map screen with a previous event selected, then use attendee navigation to Vendors.
 await p.goto(base+'/map?source=schedule&location=The%20Beyond%20Wireless%20Stage&eventTitle=Previous%20event&eventId=previous-event&showOnly=true&mapType=tented');
 await p.getByTestId('map-selection-title').waitFor();await p.getByText('Home',{exact:true}).last().click();await p.getByText('Vendors',{exact:true}).first().click();await noAuto();
 const first=await flow('returning-unfiltered');
 await p.getByText('Home',{exact:true}).last().click();await p.getByText('Vendors',{exact:true}).first().click();await noAuto();
 await p.getByPlaceholder('Search vendors',{exact:true}).fill('Ontario Government');const second=await flow('returning-filtered');assert.equal(second,'Ontario Government');assert.notEqual(first,second,'different vendors replace the previous selection');
 await p.goto(base+'/vendors');await noAuto();await p.getByPlaceholder('Search vendors',{exact:true}).fill('NO MATCH 982764');await flow('empty-filter-recovery');
 await p.goto(base+'/vendors');await noAuto();await help.click();await assertClickCue(p,'vendor-education-open-map');await tip.getByRole('button',{name:'Skip tutorial',exact:true}).click();await assertNoClickCue(p);assert.equal(await tip.count(),0);
 await p.reload();await noAuto();await help.click();await assertClickCue(p,'vendor-education-open-map');await p.keyboard.press('Escape');await assertNoClickCue(p);assert.equal(await tip.count(),0);
 await p.evaluate(()=>localStorage.removeItem('@ipm_vendor_find_on_map_tip_seen_v1'));await p.reload();await flow('first-visit',false);await p.goto(base+'/vendors');await noAuto();
 console.log(`PASS ${width}x${height}: real-data completed replay, actual action bounds/cue/touch, unrelated taps, correct vendor/highlight, stale selection replaced, final guidance, filters, skip/Escape, first visit and no repeat`);
 await c.close();
}}catch(e){if(p){await p.screenshot({path:out+'/failure.png'});console.error((await p.locator('body').innerText()).slice(-2500));}throw e;}finally{await browser.close();}
