const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('/tmp/ipm-browser-tools/node_modules/playwright');
const origin=process.env.IPM_PREVIEW_URL||'http://127.0.0.1:8837';
const out=process.env.IPM_TRAFFIC_OUTPUT||require('node:path').resolve(__dirname,'../../diagnostics/traffic-overlay');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});try {
 const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await c.route('**/*',r=>r.request().method()!=='GET'||/wonderpush|webpushr|google-analytics/.test(r.request().url())?r.abort():r.continue());
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/map');
 await p.waitForFunction(()=>document.querySelector('img[src*="grounds-site-map"]')?.complete&&!document.querySelector('[data-testid="map-artwork-grounds-loading"]'));
 const cases=[];
 for(const width of [320,360,375,390,393,412,430,768,1024,1280,1366,1440,1600,1920,2560]){
  await p.setViewportSize({width,height:width<768?844:900});await p.getByTestId('grounds-fit-reset').click();await p.waitForTimeout(350);
  const r=await p.evaluate(()=>{
   const q=id=>document.querySelector(`[data-testid="${id}"]`),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
   const image=rect(document.querySelector('img[src*="grounds-site-map"]')),notice=q('grounds-traffic-notice');
   const arrow=q('TRAFFIC-02'),a=rect(arrow),parking={x:image.x+image.w*.345,y:image.y+image.h*.615};
   return {image,notice:rect(notice),noticeText:notice.textContent,arrow:a,parking,passive:getComputedStyle(q('grounds-traffic-overlay')).pointerEvents,roads:['Durham-Rd','Greenock-Brant','Bruce-Road-2','Bruce-Road-3','Highway-9'].map(n=>getComputedStyle(q('grounds-road-'+n)).opacity),overflow:document.documentElement.scrollWidth>innerWidth+1,arrows:document.querySelectorAll('[data-testid^="TRAFFIC-"]').length,angles:['TRAFFIC-01','TRAFFIC-02','TRAFFIC-03'].map(id=>{const m=new DOMMatrix(getComputedStyle(q(id)).transform);return Math.atan2(m.b,m.a)*180/Math.PI})};
  });
  assert.equal(await p.getByText('Flow of traffic',{exact:true}).count(),1);
  const visuals=await p.evaluate(()=>{
    const q=id=>document.querySelector(`[data-testid="${id}"]`),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
    return {angles:['Durham-Rd','Greenock-Brant','Bruce-Road-2','Bruce-Road-3','Highway-9'].map(n=>{const m=new DOMMatrix(getComputedStyle(q('grounds-road-'+n)).transform);return Math.round(Math.atan2(m.b,m.a)*180/Math.PI)}),caption:box(q('grounds-flow-caption').firstElementChild),greenock:box(q('grounds-road-Greenock-Brant').firstElementChild),passive:getComputedStyle(q('grounds-flow-caption')).pointerEvents,walkerton:getComputedStyle(q('grounds-walkerton').firstElementChild).backgroundColor,flow:getComputedStyle(q('grounds-flow-caption').firstElementChild).backgroundColor,animation:getComputedStyle(q('grounds-flow-caption')).animationName};
  });
  assert.deepEqual(visuals.angles,[90,0,90,0,90]);assert.equal(visuals.passive,'none');assert.notEqual(visuals.walkerton,visuals.flow);assert.equal(visuals.animation,'none');assert.equal(visuals.flow,'rgb(255, 230, 0)');const routeY=r.image.y+r.image.h*.76;assert.ok(visuals.caption.y+visuals.caption.h<routeY);assert.ok(visuals.caption.x+visuals.caption.w<r.image.x+r.image.w*.365);const walk=await p.getByTestId('grounds-walkerton').boundingBox();assert.ok(Math.abs(walk.y+walk.height/2-r.image.y-r.image.h*.16)<1);assert.ok(visuals.caption.x+visuals.caption.w+2<visuals.greenock.x);assert.ok(visuals.caption.x>=r.image.x&&visuals.caption.x+visuals.caption.w<=r.image.x+r.image.w);assert.ok(visuals.greenock.x>=r.image.x&&visuals.greenock.x+visuals.greenock.w<=r.image.x+r.image.w);
  const gx=(visuals.greenock.x-r.image.x)/r.image.w*100;
  const routeAtLeft=r.image.y+r.image.h*(68.21+(90.5-gx)*(74.23-68.21)/(90.5-41.28))/100;
  const roadGap=visuals.greenock.y-routeAtLeft-2.5;
  assert.ok(roadGap>=3&&roadGap<=9,JSON.stringify({width,roadGap}));
  assert.ok(visuals.greenock.y+visuals.greenock.h/2<r.image.y+r.image.h*.79-8);
  assert.equal(r.arrows,3);assert.ok(r.angles[0]>-20&&r.angles[0]<0&&r.angles[1]>-110&&r.angles[1]<-90&&r.angles[2]>160&&r.angles[2]<180);assert.equal(r.roads[1],'1');assert.ok(r.notice.x>r.image.x+r.image.w*.45&&r.notice.y>=r.image.y+r.image.h*.15&&r.notice.y+r.notice.h<r.image.y+r.image.h*.34,JSON.stringify(r));assert.equal(r.passive,'none');assert.equal(r.roads[0],'1');assert.equal(r.roads[2],'0');assert.equal(r.roads[3],'1');assert.equal(r.roads[4],'1');assert.ok(!r.overflow);assert.ok(r.arrow.y>r.parking.y+3,JSON.stringify(r));
  assert.equal(r.noticeText,'Durham Road is barricaded at Huron Tractor to control traffic arriving from the east.');
  assert.ok(r.notice.x>=0&&r.notice.x+r.notice.w<=width);assert.ok(r.notice.y+r.notice.h<= (width<768?844:900)-60);
  assert.equal(await p.getByText('Traffic Flow',{exact:true}).count(),0);await p.getByTestId('grounds-walkerton').waitFor();
  assert.equal(await p.getByTestId('grounds-traffic-notice').count(),1);
  assert.equal(await p.getByTestId('grounds-traffic-notice').evaluate(e=>!!e.closest('[data-testid="grounds-traffic-overlay"]')&&getComputedStyle(e).pointerEvents==='none'),true);
  const horse=await p.getByTestId('grounds-horse-plowing-label').locator('div').first().boundingBox();
  assert.ok(horse);const hx=(horse.x+horse.width/2-r.image.x)/r.image.w*100,hy=(horse.y+horse.height/2-r.image.y)/r.image.h*100;
  assert.ok(Math.abs(hx-22.2)<.2&&Math.abs(hy-45.3)<.2);
  assert.ok(horse.x>=r.image.x+r.image.w*.178&&horse.x+horse.width<=r.image.x+r.image.w*.264&&horse.y>=r.image.y+r.image.h*.424&&horse.y+horse.height<=r.image.y+r.image.h*.481,JSON.stringify({horse,image:r.image}));
  await p.screenshot({path:`${out}/traffic-${width}.png`});cases.push({width,...r});
 }
 await p.setViewportSize({width:390,height:844});await p.getByTestId('grounds-fit-reset').click();await p.waitForTimeout(300);
 const img=p.locator('img[src*="grounds-site-map"]'),box=await img.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.wheel(0,-800);
 await p.waitForFunction(()=>getComputedStyle(document.querySelector('[data-testid="grounds-road-Bruce-Road-2"]')).opacity==='1');
 assert.equal(await p.getByTestId('grounds-road-Bruce-Road-3').evaluate(e=>getComputedStyle(e).opacity),'1');
 await p.getByTestId('grounds-fit-reset').click();await p.waitForFunction(()=>getComputedStyle(document.querySelector('[data-testid="grounds-road-Bruce-Road-2"]')).opacity==='0');
 await p.getByTestId('grounds-map-search').fill('West Parking');await p.getByText('West Parking Lot',{exact:true}).first().click();await p.locator('[data-testid^="grounds-zone-highlight-"]').waitFor();await p.getByTestId('grounds-traffic-notice').waitFor({state:'attached'});await p.getByTestId('grounds-fit-reset').click();
 await p.waitForTimeout(350);
 const camera=()=>img.evaluate(e=>new DOMMatrix(getComputedStyle(e.closest('[style*="transform:"]')).transform).a);
 const touchBox=await img.boundingBox(),cx=touchBox.x+touchBox.width*.55,cy=touchBox.y+touchBox.height*.55;
 const cd=await c.newCDPSession(p);
 await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-25,y:cy,id:1},{x:cx+25,y:cy,id:2}]});
 for(const distance of [35,45,60])await cd.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-distance,y:cy,id:1},{x:cx+distance,y:cy,id:2}]});
 await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(350);assert.ok(await camera()>1.1,'pinch zoom');
 await p.getByTestId('grounds-fit-reset').click();await p.waitForTimeout(350);
 for(let tap=0;tap<2;tap++){await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(70);}
 await p.waitForTimeout(350);assert.ok(await camera()>1.1,'double tap zoom');
 await p.getByTestId('grounds-fit-reset').click();await p.waitForTimeout(350);
 await p.evaluate(()=>document.documentElement.requestFullscreen());assert.equal(await p.evaluate(()=>!!document.fullscreenElement),true);
 await p.getByTestId('grounds-fit-reset').click();await p.evaluate(()=>document.exitFullscreen());
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/traffic-browser.json',JSON.stringify(cases,null,2));console.log('PASS 15 widths; arrows, P clearance, labels, zoom threshold/Fit, search/highlight, notice, no toggle, no errors');await c.close();
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
