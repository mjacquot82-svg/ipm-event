import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const base=process.env.IPM_TEST_URL;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try {
for(const width of [320,1440]) {
 const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
 await c.route('**/*',r=>r.request().method()==='GET'&&([new URL(base).origin,'https://ipm-backend-eoiw.onrender.com'].includes(new URL(r.request().url()).origin))?r.continue():r.abort());
 const p=await c.newPage();await p.goto(base);await p.getByText('IPM 2026 Starts In',{exact:true}).waitFor();
 await p.getByRole('button',{name:'Emergency Services',exact:true}).waitFor();await p.getByRole('button',{name:'Share IPM',exact:true}).waitFor();
 await p.goto(base+'/map');
 await p.waitForFunction(()=>Array.from(document.images).some(i=>/event-map/.test(i.src)&&i.complete&&i.naturalWidth>0));
 assert.equal(await p.locator('iframe').count(),0);
 await p.goto(base+'/schedule');await p.getByText('Schedule',{exact:true}).first().waitFor();
 await p.goto(base+'/about');await p.getByRole('button',{name:'Emergency Services / Need Help',exact:true}).click();
 await p.getByRole('heading',{name:'Emergency Services',exact:true}).waitFor();
 await p.goto(base+'/admin/login');await p.getByPlaceholder('organizer',{exact:true}).waitFor();
 console.log('PASS public Home, existing map image, Schedule, About access, Organizer login',width);await c.close();
}
}finally{await browser.close();}
