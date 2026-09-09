// Run against a local release build only; fixtures never contact notification providers.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const base=process.env.IPM_TEST_URL||'http://localhost:8101';
const page = await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror', e=>console.log('PAGE ERROR',e.message));
await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
await page.route('**/api/**', async route=>{
 if(route.request().method() !== 'GET') throw new Error('Unexpected API mutation');
 const url=route.request().url(); let body={};
 if(url.endsWith('/auth/me')) body={user:{id:'fixture',username:'fixture',display_name:'Test Admin',role:'Owner',event_id:'ipm-2026'}};
 else if(url.includes('/notification-health')) body={registrations:127,checked:20,not_yet_checked:107,verified:10,repairable_mismatch:3,key_mismatch:2,other_ineligible:2,other_checked:3,uncertain:1,active_leases:1,expired_leases:0,retries_due:2,retries_scheduled:2,provider_ready:18,provider_ready_stale:3,verified_expired:1,current_check_failures:1,repairs_attempted:null,repairs_verified:null,repair_failures:null,repair_history:'NOT_RECORDED',circuit:'OPEN',circuit_open_until:'2026-09-09T12:00:00Z',latest_activity_at:'2026-09-08T12:00:00Z',snapshot_at:'2026-09-08T12:05:00Z'};
 else if(url.includes('/analytics/')) return route.fulfill({status:503,json:{detail:'Fixture: other analytics unavailable'}});
 else body={announcements:[],schedule:[],vendors:[],users:[],deliveries:[]};
 await route.fulfill({json:body});
});
await page.goto(base+'/admin/',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2000);
const dismiss=page.getByText('Maybe later — continue to the app', {exact:true});
if(await dismiss.count()) await dismiss.click();
await page.getByText('Analytics',{exact:true}).first().click();
await page.getByText('Notification Health',{exact:true}).waitFor();
for (const width of [1440,390]) {
 await page.setViewportSize({width,height:1000});
 await page.waitForTimeout(400);
 const text=await page.locator('body').innerText();
 for(const phrase of ['Notification registrations','Not yet checked','Repairs verified','Not recorded','Open — checks paused','Needs attention']) {
  if(!text.includes(phrase)) throw new Error('Missing '+phrase);
 }
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 if(overflow) throw new Error('Horizontal overflow at '+width);
 await page.getByText('Notification Health',{exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:`/tmp/ipm-health-${width}.png`,fullPage:true});
 await page.getByText('Repair and check health',{exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:`/tmp/ipm-health-repairs-${width}.png`,fullPage:true});
 console.log('PASS notification health layout',width);
}
await browser.close();
