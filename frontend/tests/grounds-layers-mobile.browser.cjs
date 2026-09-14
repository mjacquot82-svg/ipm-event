const assert=require('node:assert/strict');
const {chromium,webkit}=require('/tmp/ipm-browser-tools/node_modules/playwright');
const origin=process.env.IPM_PREVIEW_URL||'http://127.0.0.1:8863';
(async()=>{
  for(const engine of [chromium,webkit]){
    const b=await engine.launch({args:engine===chromium?['--no-sandbox']:[]});
    try{
      const c=await b.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,serviceWorkers:'block'});
      await c.route('**/*',r=>r.request().method()!=='GET'||/wonderpush|webpushr|google-analytics|ipm-backend/.test(r.request().url())?r.abort():r.continue());
      await c.addInitScript(()=>{
        const original=window.getComputedStyle;
        window.getComputedStyle=function(e,...rest){const s=original.call(this,e,...rest);return e.style.paddingTop.includes('safe-area-inset-top')?new Proxy(s,{get(t,k){if(k==='paddingTop')return '59px';const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v;}}):s;};
      });
      const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/map');
      await p.waitForFunction(()=>document.querySelector('img[src*="grounds-site-map"]')?.complete&&!document.querySelector('[data-testid="map-artwork-grounds-loading"]'));
      await p.evaluate(()=>window.originalGrounds=document.querySelector('img[src*="grounds-site-map"]'));
      for(const view of ['general','traffic','parking','general','parking']){
        await p.getByTestId('grounds-view-'+view).tap();
        assert.equal(await p.evaluate(()=>window.originalGrounds===document.querySelector('img[src*="grounds-site-map"]')),true);
        const control=await p.getByTestId('grounds-view-selector').boundingBox(),selector=await p.getByTestId('map-mode-selector').boundingBox();
        assert.ok(selector.y>=59&&control.y+control.height<=852-60);
        assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      }
      await p.getByTestId('grounds-parking-1').tap();await p.getByTestId('grounds-parking-info').getByText('Buses Only',{exact:true}).waitFor();
      await p.getByLabel('Close parking information').tap();await p.getByTestId('grounds-fit-reset').tap();
      await p.getByTestId('grounds-map-search').fill('West Parking');await p.getByText('West Parking Lot',{exact:true}).first().tap();await p.locator('[data-testid^="grounds-zone-highlight-"]').waitFor();
      await p.getByTestId('grounds-view-general').tap();await p.locator('[data-testid^="grounds-zone-highlight-"]').waitFor();
      assert.deepEqual(errors,[]);console.log('PASS',engine.name(),'touch switching/marker/Fit/search, 59px safe inset, bottom navigation clearance, no remount/errors');
      await c.close();
    }finally{await b.close();}
  }
})().catch(e=>{console.error(e);process.exitCode=1});
