const assert=require('node:assert/strict');
const {chromium}=require(process.env.IPM_PLAYWRIGHT_MODULE||'/tmp/ipm-browser-tools/node_modules/playwright');
const origin=process.env.IPM_PREVIEW_URL||'http://127.0.0.1:8817';
const names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
(async()=>{
 const payload=await (await fetch('https://ipm-backend-eoiw.onrender.com/api/schedule')).json();
 const sunday=payload.events.find(e=>e.start_date==='2026-09-20'),monday=payload.events.find(e=>e.start_date==='2026-09-21');assert.ok(sunday&&monday);
 const b=await chromium.launch({args:['--no-sandbox']});try{
  const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await c.route('**/*',r=>r.request().method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
  await c.route('https://ipm-backend-eoiw.onrender.com/**',async r=>{if(r.request().method()!=='GET')return r.abort();try{if(new URL(r.request().url()).pathname==='/api/schedule')return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(payload)});const response=await r.fetch();await r.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':'*'}})}catch(e){if(!/closed|disposed/.test(e.message))throw e}});
  await c.addInitScript(ids=>{if(!localStorage.getItem('@event_navigator_favorites'))localStorage.setItem('@event_navigator_favorites',JSON.stringify({sessionIds:ids}))},[sunday.id,monday.id]);
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin+'/schedule');await p.getByText('Sunday',{exact:true}).first().waitFor();
  const dayLabels=p.getByText('Sunday',{exact:true}).first().locator('../..').getByText(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/);
  assert.deepEqual(await dayLabels.allTextContents(),names);
  assert.equal(await p.getByText('Clear filters',{exact:true}).count(),0);
  await p.getByText('Sunday, September 20',{exact:true}).waitFor();
  console.log('PASS Sunday→Saturday selector / actual first date / default All days');
  const saved=await p.evaluate(()=>localStorage.getItem('@event_navigator_favorites'));
  // Expand the test viewport so the virtualized list exposes every event in a day.
  // Initial/default and final navigation checks retain the normal phone viewport.
  await p.setViewportSize({width:390,height:30000});
  for(const [name,event,other,date] of names.map((name,i)=>[name,payload.events.find(e=>e.start_date===`2026-09-${20+i}`),i===0?monday:sunday,`${name}, September ${20+i}`])){
   await p.getByText(name,{exact:true}).first().click();await p.getByText(date,{exact:true}).waitFor();await p.getByText(event.title,{exact:true}).first().waitFor();
   assert.equal(await p.getByText(other.title,{exact:true}).count(),0);
   const buttons=p.getByRole('button',{name:/^(Add|Remove) .* (to|from) itinerary$/});
   await p.waitForFunction(count=>document.querySelectorAll('[aria-label$="to itinerary"], [aria-label$="from itinerary"]').length===count,payload.events.filter(e=>e.start_date===event.start_date).length);
   assert.equal(await buttons.count(),payload.events.filter(e=>e.start_date===event.start_date).length);
   const time=value=>{const match=value.match(/(\d+):?(\d*)\s*(AM|PM)?/i);if(!match)return 0;let hour=Number(match[1]);if(match[3]?.toUpperCase()==='PM'&&hour!==12)hour+=12;if(match[3]?.toUpperCase()==='AM'&&hour===12)hour=0;return hour*60+Number(match[2]||0)};
   const expected=payload.events.filter(e=>e.start_date===event.start_date).sort((a,b)=>time(a.start_time)-time(b.start_time));
   assert.deepEqual(await buttons.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label').replace(/^(Add|Remove) /,'').replace(/ (to|from) itinerary$/,''))),expected.map(e=>e.title));
   assert.equal(await p.evaluate(()=>localStorage.getItem('@event_navigator_favorites')),saved);
   console.log('PASS '+name+' contains only correct events / favourite state unchanged');
  }
  await p.getByText('Saturday',{exact:true}).first().click();assert.equal(await p.getByText('Clear filters',{exact:true}).count(),0);
  await p.getByRole('button',{name:`Remove ${sunday.title} from itinerary`,exact:true}).click();
  await p.getByRole('button',{name:`Add ${sunday.title} to itinerary`,exact:true}).click();
  const stored=await p.evaluate(()=>JSON.parse(localStorage.getItem('@event_navigator_favorites')).sessionIds);
  assert.deepEqual([...stored].sort(),[sunday.id,monday.id].sort());
  console.log('PASS all seven dates / within-day event order / favourite remove and restore');
  await p.setViewportSize({width:390,height:844});
  await p.goto(origin+'/itinerary');await p.getByText('2 starred events',{exact:true}).waitFor();await p.getByText(sunday.title,{exact:true}).waitFor();await p.getByText(monday.title,{exact:true}).waitFor();
  assert.deepEqual((await p.evaluate(()=>JSON.parse(localStorage.getItem('@event_navigator_favorites')).sessionIds)).sort(),[sunday.id,monday.id].sort());console.log('PASS itinerary membership and stored favourites preserved');
  const stage=payload.events.find(e=>e.location_name==='The Beyond Wireless Stage');assert.ok(stage);
  await p.goto(origin+'/schedule?eventId='+encodeURIComponent(stage.id));await p.getByText('Tap to view on map',{exact:true}).waitFor();await p.getByText('Tap to view on map',{exact:true}).click();
  await p.getByTestId('selected-stage-highlight').waitFor();console.log('PASS Schedule Find-on-Map → MNP');
  await p.goto(origin+'/schedule');await p.getByText('Sunday',{exact:true}).first().waitFor();
  await p.screenshot({path:'../diagnostics/schedule-date-order/preview-sunday-first.png'});
  assert.deepEqual(errors,[]);console.log('PASS no browser runtime errors');await c.close();
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
