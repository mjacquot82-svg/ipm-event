// Built-shell tests. All external writes and notification providers are blocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.IPM_PLAYWRIGHT_MODULE||'/tmp/ipm-browser-tools/node_modules/playwright');
const origin=process.env.IPM_PREVIEW_URL||'http://127.0.0.1:8870';
const out=process.env.IPM_TOUR_OUTPUT||path.resolve(__dirname,'../../diagnostics/maps-guided-tour/browser');
const keys=['@ipm_maps_tour_seen_v1','@ipm_schedule_find_on_map_tip_seen_v1','@ipm_vendor_find_on_map_tip_seen_v1'];
const titles=['Parking info','Find exhibitors','Find your campsite','Search the maps','Jump straight to a location'];
const targets=['grounds-view-parking','map-mode-tented','map-mode-rv','grounds-map-search','map-mode-grounds'];
const widths=[320,360,375,390,393,412,430,768,1024,1280,1366,1440,1600,1920,2560];
const card=p=>p.getByTestId('map-education-card');
async function setup(browser,options={}) {
 const c=await browser.newContext({viewport:{width:393,height:852},reducedMotion:'reduce',serviceWorkers:'block',...options});
 await c.route('**/*',r=>r.request().method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
 return c;
}
async function step(p,index,width) {
 await card(p).getByText(titles[index],{exact:true}).waitFor();
 await p.getByTestId('map-education-spotlight').waitFor();
 await p.waitForTimeout(300);
 const a=await p.getByTestId(targets[index]).boundingBox(),b=await p.getByTestId('map-education-spotlight').boundingBox(),c=await card(p).boundingBox();
 assert.ok(Math.abs(a.x-3-b.x)<2&&Math.abs(a.y-3-b.y)<2,`anchor ${width}/${index}: ${JSON.stringify({a,b})}`);
 assert.ok(c.x>=0&&c.x+c.width<=width+1&&c.y>=0&&c.y+c.height<=p.viewportSize().height,`card bounds ${width}/${index}`);
 assert.ok(c.y+c.height<=a.y||c.y>=a.y+a.height,'card must not cover explained control');
 assert.equal(await p.getByTestId('grounds-view-general').getAttribute('aria-selected'),'true');
 assert.equal(await p.getByTestId('map-mode-grounds').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
 for(const button of await card(p).getByRole('button').all()) {const r=await button.boundingBox();assert.ok(r.y>=c.y&&r.y+r.height<=c.y+c.height+1,'actions fully visible');assert.ok(r.height>=44);}
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 return {width,step:index+1,anchor:a,card:c};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const b=await chromium.launch({args:['--no-sandbox']});const records=[];
 try {
  const c=await setup(b),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin+'/map');await card(p).waitFor();
  for(const width of widths){
   await p.setViewportSize({width,height:width<768?844:1000});
   if(width!==widths[0])await p.getByRole('button',{name:'Help, replay Maps tour'}).click();
   for(let i=0;i<5;i++){records.push(await step(p,i,width));if([320,393,1440,2560].includes(width))await p.screenshot({path:path.join(out,`${width}-step-${i+1}.png`)});await card(p).getByRole('button',{name:i===4?'Got it':'Next',exact:true}).click();}
   await card(p).waitFor({state:'hidden'});
  }
  assert.deepEqual(await p.evaluate(ks=>ks.map(k=>localStorage.getItem(k)),keys),['true',null,null]);
  await p.reload();await p.getByRole('button',{name:'Help, replay Maps tour'}).waitFor();await p.waitForTimeout(900);assert.equal(await card(p).count(),0);
  await p.getByRole('button',{name:'Help, replay Maps tour'}).click();await card(p).waitFor();await p.waitForTimeout(200);
  assert.equal(await p.evaluate(()=>document.activeElement?.textContent),'Next');
  await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement?.textContent),'Skip');
  await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>document.activeElement?.textContent),'Next');
  await p.keyboard.press('Escape');await card(p).waitFor({state:'hidden'});assert.equal(await p.getByRole('button',{name:'Help, replay Maps tour'}).evaluate(e=>e===document.activeElement),true);
  await p.getByTestId('map-mode-rv').click();await p.getByRole('button',{name:'Help, replay Maps tour'}).click();await card(p).getByText(/On Grounds/).waitFor();assert.equal(await p.getByTestId('map-mode-rv').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');await p.keyboard.press('Escape');
  await p.evaluate(ks=>{localStorage.setItem(ks[1],'true');localStorage.setItem(ks[2],'true');},keys);await p.getByRole('button',{name:'Help, replay Maps tour'}).click();await card(p).waitFor();await card(p).getByRole('button',{name:'Skip Maps tour'}).click();assert.deepEqual(await p.evaluate(ks=>ks.map(k=>localStorage.getItem(k)),keys),['true','true','true']);
  // A new page with the same device storage represents closing and reopening the app.
  await p.close();const reopened=await c.newPage();await reopened.goto(origin+'/map');await reopened.getByRole('button',{name:'Help, replay Maps tour'}).waitFor();await reopened.waitForTimeout(900);assert.equal(await card(reopened).count(),0);
  assert.deepEqual(errors,[]);await c.close();
  const skipContext=await setup(b),skip=await skipContext.newPage();await skip.goto(origin+'/map');await card(skip).getByRole('button',{name:'Skip Maps tour'}).click();await skip.reload();await skip.getByRole('button',{name:'Help, replay Maps tour'}).waitFor();await skip.waitForTimeout(900);assert.equal(await card(skip).count(),0);await skipContext.close();
  console.log('PASS first visit, all five anchors, 15 widths, no map/layer mutation, completion, Skip, Help, independent flags, close/reopen, Escape/Tab/focus, reduced motion');
  fs.writeFileSync(path.join(out,'layout.json'),JSON.stringify(records,null,2));
 } finally {await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
