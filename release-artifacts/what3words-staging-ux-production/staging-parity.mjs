import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const out=process.env.IPM_ARTIFACT_DIR;
const data=[];
try {
for(const width of [320,390,1440]) {
 const pair=[];
 for(const [name,base] of [['authority','https://6aa091b2b8f161cc3b981158--ipm-web-staging.netlify.app'],['candidate',process.env.IPM_TEST_URL]]) {
  const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await c.route('**/*',r=>r.request().method()==='GET'&&new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  const p=await c.newPage();await p.goto(base+'/emergency-services');
  const heading=p.getByRole('heading',{name:'Emergency Services',exact:true});await heading.waitFor();
  await p.evaluate(()=>document.fonts.ready);
  const section=heading.locator('../..');
  const snapshot=await section.evaluate(el=>({text:el.innerText,labels:Array.from(el.querySelectorAll('[aria-label]'),e=>e.getAttribute('aria-label')),elements:Array.from(el.querySelectorAll('*')).filter(e=>e.textContent&&e.children.length===0).map(e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return {text:e.textContent,font:s.fontFamily,size:s.fontSize,line:s.lineHeight,color:s.color,width:Math.round(b.width),height:Math.round(b.height)};})}));
  await section.screenshot({path:`${out}/${name}-emergency-${width}.png`});pair.push(snapshot);await c.close();
 }
 assert.deepEqual(pair[1],pair[0]);data.push({width,exact_rendered_text_labels_and_styles:true});
 console.log('PASS historical staging deployment / candidate Emergency rendered parity',width);
}
}finally{await browser.close();}
writeFileSync(`${out}/staging-rendered-parity.json`,JSON.stringify(data,null,2));
