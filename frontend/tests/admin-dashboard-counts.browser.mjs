// Published/local bundle regression. Auth and API responses are browser-local; no server writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.IPM_TEST_URL || 'http://127.0.0.1:8891';
const out=process.env.IPM_TEST_OUTPUT || '.artifacts/dashboard-counts';fs.mkdirSync(out,{recursive:true});
const input=process.env.DASHBOARD_API_SNAPSHOT;
const vendors=input?JSON.parse(fs.readFileSync(input+'/vendors.json')):{vendors:[{id:'v1',name:'Vendor One'}],total_count:1};
const schedule=input?JSON.parse(fs.readFileSync(input+'/schedule.json')):{events:[{id:'e1',row_number:2,title:'Event One',start_date:'2026-09-22',start_time:'10:00',days_active:'Tuesday'}],total_count:1};
const browser=await chromium.launch();
try{
 for(const scenario of ['success','partial-failure','empty']){
  const c=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  let release;const gate=new Promise(resolve=>release=resolve);let failed=scenario==='partial-failure';const requests=[];const errors=[];
  await c.route('**/*',async r=>{
   const q=r.request(),u=new URL(q.url());
   if(!['GET','HEAD','OPTIONS'].includes(q.method())||/wonderpush|webpushr|google-analytics/.test(q.url()))return r.abort();
   if(u.pathname.startsWith('/api/admin/')){
    requests.push(u.pathname);
    if(u.pathname.endsWith('/auth/me'))return r.fulfill({json:{user:{id:'local-owner',username:'owner',display_name:'Owner',role:'Owner',event_id:'ipm-2026',is_active:true}}});
    await gate;
    if(u.pathname.endsWith('/vendors'))return r.fulfill({json:scenario==='empty'?{vendors:[],total_count:0}:vendors});
    if(u.pathname.endsWith('/schedule'))return failed?r.fulfill({status:503,json:{detail:'Schedule temporarily unavailable'}}):r.fulfill({json:scenario==='empty'?{events:[],total_count:0}:schedule});
    return r.abort();
   }
   return r.continue();
  });
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/admin/');await p.getByText('Event operations overview',{exact:true}).waitFor();
  const value=label=>p.getByText(label,{exact:true}).last().locator('..');
  await p.waitForFunction(()=>[...document.querySelectorAll('div')].filter(e=>e.textContent==='Loading…').length>=2);
  assert.match(await value('Vendors').innerText(),/Loading…/);assert.match(await value('Schedule').innerText(),/Loading…/);
  assert(requests.includes('/api/admin/vendors')&&requests.includes('/api/admin/schedule'),'Dashboard independently requests both datasets');
  release();
  async function counts(v,s){await value('Vendors').getByText(String(v),{exact:true}).waitFor();await value('Schedule').getByText(String(s),{exact:true}).waitFor();}
  if(scenario==='partial-failure'){
   await value('Schedule').getByText('Unavailable',{exact:true}).waitFor();await value('Vendors').getByText(String(vendors.total_count),{exact:true}).waitFor();
   await p.getByText('Schedule temporarily unavailable',{exact:true}).waitFor();failed=false;await p.getByText('Retry',{exact:true}).click();await counts(vendors.total_count,schedule.total_count);
  }else if(scenario==='empty'){await counts(0,0);}
  else{
   await counts(vendors.total_count,schedule.total_count);
   await p.screenshot({path:out+'/direct-dashboard.png'});
   await p.getByText('Vendors',{exact:true}).first().click();await p.getByPlaceholder('Search vendors by name, type, location, or hours').waitFor();
   await p.getByText('Dashboard',{exact:true}).first().click();await counts(vendors.total_count,schedule.total_count);
   await p.getByText('Schedule',{exact:true}).first().click();await p.getByPlaceholder('Search schedule by title, location, category, or date').waitFor();
   await p.getByText('Dashboard',{exact:true}).first().click();await counts(vendors.total_count,schedule.total_count);
   await p.setViewportSize({width:390,height:844});await counts(vendors.total_count,schedule.total_count);
   await p.screenshot({path:out+'/phone-dashboard.png'});
  }
  assert.deepEqual(errors,[]);console.log('PASS',scenario,'counts',scenario==='empty'?[0,0]:[vendors.total_count,schedule.total_count]);await c.close();
 }
}finally{await browser.close();}
