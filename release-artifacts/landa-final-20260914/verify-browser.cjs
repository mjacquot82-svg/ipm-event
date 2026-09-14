/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('/tmp/ipm-browser-tools/node_modules/playwright');
const root=path.resolve(__dirname,'../..'), origin=process.env.IPM_PREVIEW_URL||'http://127.0.0.1:8872';
const expected=JSON.parse(fs.readFileSync(path.join(root,'diagnostics/landa-final/schedule-expected.json')));
const media=JSON.parse(fs.readFileSync(path.join(__dirname,'sources.json'))).event_image;
const out=path.join(root,'diagnostics/landa-final');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});try{
 for(const width of [360,393,430,1440]){
  const c=await b.newContext({viewport:{width,height:width<768?852:1000},serviceWorkers:'block'});
  await c.addInitScript(()=>{for(const k of ['@ipm_schedule_itinerary_onboarding_v1','@ipm_schedule_event_details_tip_seen_v1','@ipm_schedule_find_on_map_tip_seen_v1','@ipm_maps_tour_seen_v1'])localStorage.setItem(k,'true');});
  await c.route('**/*',r=>{
   const req=r.request();if(req.method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(req.url()))return r.abort();
   if(origin.startsWith('http://127.')&&req.url().endsWith('/api/schedule'))return r.fulfill({json:expected});
   if(origin.startsWith('http://127.')&&req.url()===media.url)return r.fulfill({body:fs.readFileSync(path.join(root,'frontend/public/event-media',path.basename(media.url))),contentType:'image/jpeg'});
   return r.continue();
  });
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const id of ['d2896e1e-8203-4e15-8ec8-ea1d82677e1f','69f9ab32-bee3-5ac4-b97f-8c97d4b99bf7']){
   const e=expected.events.find(e=>e.id===id),person=id.startsWith('d289')?'brenda':'carol';
   await p.goto(origin+'/schedule?eventId='+id);
   const bio=p.getByText(e.description,{exact:true}).last();await bio.waitFor();await bio.scrollIntoViewIfNeeded();
   assert.equal(await bio.textContent(),e.description);assert.equal(await p.getByTestId('map-education-card').count(),0);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(person==='carol'){
    const img=p.getByRole('img',{name:'Carol Weigel',exact:true});await img.scrollIntoViewIfNeeded();
    await img.evaluate(img=>img.decode());assert.deepEqual(await img.evaluate(i=>[i.naturalWidth,i.naturalHeight]),[480,640]);
    const box=await img.boundingBox();assert.ok(box.width<=240&&box.height<=260&&Math.abs(box.width/box.height-.75)<.01);
   }else assert.equal(await p.locator('img[src*="/event-media/"]').count(),0);
   await p.screenshot({path:path.join(out,`${origin.startsWith('https:')?'live':'local'}-${person}-${width}.png`)});
   await p.getByText('Add to Itinerary',{exact:true}).click();
   await p.waitForFunction(id=>JSON.parse(localStorage.getItem('@event_navigator_favorites'))?.sessionIds.includes(id),id);
   await p.getByText('Remove from Itinerary',{exact:true}).click();
   await p.waitForFunction(id=>!JSON.parse(localStorage.getItem('@event_navigator_favorites'))?.sessionIds.includes(id),id);
   await p.getByTestId('schedule-find-on-map').scrollIntoViewIfNeeded();await p.getByTestId('schedule-find-on-map').click();
   await p.getByTestId('selected-stage-highlight').waitFor();
  }
  await p.goto(origin+'/schedule');await p.getByPlaceholder('Search schedule').fill('Carol');
  await p.getByText('Carrick Farm Market - All things Canning',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log(`PASS ${width}: Brenda exact existing bio/no image; Carol exact supplied bio/decoded original portrait; no overflow; star add/remove; map destinations; search`);
  await c.unrouteAll({behavior:'wait'});await c.close();
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
