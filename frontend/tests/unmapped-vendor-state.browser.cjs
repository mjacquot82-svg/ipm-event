const assert=require('node:assert/strict');
const {chromium}=require(process.env.IPM_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const origin=process.env.IPM_PREVIEW_URL;assert.ok(origin&&!/^https:\/\/(theipm\.ca|staging\.theipm\.ca)(\/|$)/.test(origin),'Preview only');
 const b=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const p=await b.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});const errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
  const message="Exact map location isn't available yet.";
  await p.goto(origin+'/vendors');await p.getByPlaceholder('Search vendors').waitFor({timeout:60000});
  for(const [q,loc] of [['Valard','EAST-06'],['CAN-AM','WEST-02']]){
   await p.getByPlaceholder('Search vendors').fill(q);await p.getByText('Location: '+loc,{exact:true}).waitFor();await p.getByText(message,{exact:true}).waitFor();assert.equal(await p.getByText('Find on Map',{exact:true}).count(),0);console.log('VENDOR UNAVAILABLE PASS',q,loc);
  }
  for(const q of ['Bambrook','Ontario Government']){
   await p.getByPlaceholder('Search vendors').fill(q);await p.getByText('Find on Map',{exact:true}).waitFor();assert.equal(await p.getByText(message,{exact:true}).count(),0);console.log('PRECISE VENDOR ACTION PASS',q);
  }
  await p.getByText('Find on Map',{exact:true}).click();
  await p.getByTestId('vendor-booth-highlight').first().waitFor();
  const search=p.getByPlaceholder('Find a vendor, booth, stage, or place');
  for(const [q,name,loc] of [['Valard','Valard Construction, Vaughan','EAST-06'],['CAN-AM','Can-Am Demo Area, Montreal, QC','WEST-02']]){
   await search.fill(q);await p.getByText(name,{exact:true}).click();await p.getByText(message,{exact:true}).waitFor();await p.getByText('Location: '+loc,{exact:true}).waitFor();
   for(const id of ['selected-booth-highlight','vendor-booth-highlight','selected-stage-highlight','selected-parent-range-fill'])assert.equal(await p.getByTestId(id).count(),0,id);
   console.log('MAP UNAVAILABLE / NO STALE HIGHLIGHT PASS',q);
  }
  await p.goto(origin+'/map?mapType=tented&location='+encodeURIComponent('The Beyond Wireless Stage'));
  await p.getByTestId('selected-stage-highlight').waitFor();assert.equal(await p.getByText(message,{exact:true}).count(),0);console.log('MNP PARENT FALLBACK PASS');
  assert.deepEqual(errors,[]);console.log('NO RUNTIME ERRORS');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
