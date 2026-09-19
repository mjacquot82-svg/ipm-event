import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL || 'http://127.0.0.1:8870';
const out=process.env.IPM_TEST_OUTPUT || '.artifacts/parking-help/browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
try {for(const width of [390,768,1440])for(const seen of [false,true]){
 const c=await browser.newContext({viewport:{width,height:900},hasTouch:true,serviceWorkers:'block'});
 await c.route('**/*',r=>r.request().method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
 if(seen)await c.addInitScript(()=>localStorage.setItem('@ipm_maps_tour_seen_v1','true'));
 const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/map');
 const help=p.getByRole('button',{name:'Map Help, replay Maps tour',exact:true}),card=p.getByTestId('map-education-card');
 if(seen){await help.waitFor();await p.waitForTimeout(800);assert.equal(await card.count(),0);await help.click();}
 for(let i=0;i<5;i++){
  await card.getByText(`${i+1} of 5`,{exact:true}).waitFor();await p.waitForTimeout(350);
  if(i===0){await p.getByLabel('Official entrances and parking map',{exact:true}).waitFor();assert.match(await card.innerText(),/official entrance and parking map/);assert.equal(await p.getByTestId('grounds-view-parking').count(),0);}
  if(i===2){const a=await p.getByTestId('parade-routes-control').boundingBox(),s=await p.getByTestId('map-education-spotlight').boundingBox();assert(Math.abs(a.x-3-s.x)<2&&Math.abs(a.y-3-s.y)<2);assert.match(await card.innerText(),/Tuesday or Wednesday–Saturday/);}
  if(i===0||i===2)await p.screenshot({path:`${out}/${width}-${seen}-step${i+1}.png`});
  await card.getByRole('button',{name:i===4?'Got it':'Next',exact:true}).click();
 }
 await card.waitFor({state:'hidden'});assert.equal(await p.evaluate(()=>localStorage.getItem('@ipm_maps_tour_seen_v1')),'true');
 assert.equal(await help.innerText(),'Map Help');
 for(const mode of ['grounds','tented','rv','entrances']){
  const tab=p.getByTestId('map-mode-'+mode),r=await tab.boundingBox();assert(r.x>=0&&r.x+r.width<=width+1,'all four tabs visible');await tab.click();await help.waitFor();
  assert(await help.evaluate(e=>{const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return e===hit||e.contains(hit)}),'Help unobstructed');
  assert.equal(await p.getByTestId('grounds-view-parking').count(),0);
 }
 await p.screenshot({path:`${out}/${width}-${seen}-parking.png`});
 const layer=p.getByTestId('entrances-map-layer'),before=await layer.evaluate(e=>getComputedStyle(e).transform);
 const v=await p.getByTestId('entrances-map-viewport').boundingBox();await p.mouse.move(v.x+v.width/2,v.y+v.height/2);await p.mouse.wheel(0,-220);await p.waitForTimeout(350);assert.notEqual(await layer.evaluate(e=>getComputedStyle(e).transform),before);
 await p.getByLabel('Fit entrances and parking map',{exact:true}).click();
 await help.click();await card.getByRole('button',{name:'Skip tutorial'}).click();await p.getByLabel('Official entrances and parking map',{exact:true}).waitFor();
 await p.reload();await help.waitFor();await p.waitForTimeout(800);assert.equal(await card.count(),0);await help.click();await card.waitFor();await p.keyboard.press('Escape');
 await p.getByText('Home',{exact:true}).click();await p.getByText('Map',{exact:true}).last().click();await help.waitFor();await p.waitForTimeout(800);assert.equal(await card.count(),0);assert.deepEqual(errors,[]);
 console.log(`PASS ${width} seen=${seen}: five-step tour, parking image, parade spotlight, four visible tabs, Help after completion/reopen, parking zoom/fit`);await c.close();
}}finally{await browser.close();}
