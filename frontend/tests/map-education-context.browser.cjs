const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.IPM_PLAYWRIGHT_MODULE||'/tmp/ipm-browser-tools/node_modules/playwright');
const origin=process.env.IPM_PREVIEW_URL||'http://127.0.0.1:8870';
const schedule=JSON.parse(fs.readFileSync(process.env.IPM_SCHEDULE_SNAPSHOT||path.resolve(__dirname,'./fixtures/map-education-schedule.json')));
const catalog=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../public/api/vendors.json')));
const keys=['@ipm_maps_tour_seen_v1','@ipm_schedule_find_on_map_tip_seen_v1','@ipm_vendor_find_on_map_tip_seen_v1'];
const card=p=>p.getByTestId('map-education-card');
async function context(b,vendors,ack=true){
 const c=await b.newContext({viewport:{width:393,height:852},serviceWorkers:'block'});
 await c.route('**/*',async r=>{
  const u=r.request().url();if(r.request().method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(u))return r.abort();
  if(u.endsWith('/api/schedule'))return r.fulfill({json:schedule});
  if(vendors&&u.endsWith('/api/vendors'))return r.fulfill({json:{...catalog,vendors}});
  if(/onrender/.test(u))return r.abort();return r.continue();
 });
 if(ack)await c.addInitScript(()=>localStorage.setItem('@ipm_schedule_itinerary_onboarding_v1','true'));
 return c;
}
async function event(p,row){await p.goto(origin+'/schedule?eventId='+row.id);await p.getByTestId('schedule-find-on-map').waitFor();await p.getByTestId('schedule-find-on-map').scrollIntoViewIfNeeded();}
async function anchored(p,id){await card(p).waitFor();await p.getByTestId('map-education-spotlight').waitFor();await p.waitForTimeout(350);const a=await p.getByTestId(id).boundingBox(),b=await p.getByTestId('map-education-spotlight').boundingBox();assert.ok(b.y<=a.y+1&&b.y+b.height>=a.y+a.height-1);assert.equal(await card(p).count(),1);}
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});try{
 const mapped=schedule.events.find(e=>e.location_name==='The Beyond Wireless Stage');const unmapped=schedule.events.find(e=>/Parade route coming soon/.test(e.location_name));assert.ok(mapped&&unmapped);
 const c=await context(b),p=await c.newPage();await event(p,unmapped);await p.waitForTimeout(1100);assert.equal(await card(p).count(),0);assert.equal(await p.evaluate(k=>localStorage.getItem(k),keys[1]),null);
 await event(p,mapped);await anchored(p,'schedule-find-on-map');await card(p).getByText('Find this event',{exact:true}).waitFor();assert.ok(p.url().includes('/schedule'));await p.keyboard.press('Escape');await card(p).waitFor({state:'hidden'});assert.equal(await p.getByTestId('schedule-find-on-map').isVisible(),true,'Escape closes tip before event detail');
 assert.deepEqual(await p.evaluate(ks=>ks.map(k=>localStorage.getItem(k)),keys),[null,'true',null]);await event(p,mapped);await p.waitForTimeout(1100);assert.equal(await card(p).count(),0);
 await p.getByTestId('schedule-find-on-map').click();await card(p).getByText('Find parking',{exact:true}).waitFor();await card(p).getByRole('button',{name:'Skip Maps tour'}).click();await p.getByTestId('selected-stage-highlight').waitFor();console.log('PASS Schedule mapped-only, once, Escape, flags independent, unchanged destination and first deep-linked Maps visit');await c.close();
 for(const name of ['Valard','Can-Am']){
  const row=catalog.vendors.find(v=>v.name.includes(name));assert.ok(row);const c=await context(b,[row]),p=await c.newPage();await p.goto(origin+'/vendors');await p.getByText("Exact map location isn't available yet.",{exact:true}).waitFor();await p.waitForTimeout(1100);assert.equal(await card(p).count(),0);assert.equal(await p.getByTestId('vendor-find-on-map').count(),0);await c.close();
 }
 const vendor=catalog.vendors.find(v=>v.name==='Ontario Government');assert.ok(vendor);
 const vc=await context(b,[vendor]),vp=await vc.newPage();await vp.goto(origin+'/vendors');await vp.getByTestId('vendor-find-on-map').scrollIntoViewIfNeeded();await anchored(vp,'vendor-find-on-map');await card(vp).getByText('Find this vendor',{exact:true}).waitFor();assert.ok(vp.url().includes('/vendors'));await card(vp).getByRole('button',{name:'Got it'}).click();assert.deepEqual(await vp.evaluate(ks=>ks.map(k=>localStorage.getItem(k)),keys),[null,null,'true']);await vp.reload();await vp.getByTestId('vendor-find-on-map').waitFor();await vp.waitForTimeout(1000);assert.equal(await card(vp).count(),0);await vp.getByTestId('vendor-find-on-map').click();await card(vp).getByRole('button',{name:'Skip Maps tour'}).click();await vp.getByTestId('vendor-booth-highlight').waitFor();await event(vp,mapped);await card(vp).getByText('Find this event',{exact:true}).waitFor();console.log('PASS Vendor mapped-only, once, Got it, CAN-AM/Valard unavailable, separate flags, unchanged vendor routing');await vc.close();
 const intro=await context(b,undefined,false),ip=await intro.newPage();await ip.goto(origin+'/schedule');await ip.getByText('Plan your day',{exact:true}).waitFor();await ip.waitForTimeout(1100);assert.equal(await card(ip).count(),0);await ip.getByRole('button',{name:'Got it, close Plan your day introduction'}).click();await event(ip,mapped);await card(ip).getByText('Find this event',{exact:true}).waitFor();console.log('PASS contextual education waits for existing Schedule introduction');await intro.close();
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
