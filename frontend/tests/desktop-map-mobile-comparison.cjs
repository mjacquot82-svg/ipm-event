// Requires preserved baseline/candidate captures from the same Chromium viewport setup.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PNG}=require('pngjs');
const dir=process.env.IPM_SCREENSHOTS||path.resolve(__dirname,'../../diagnostics/desktop-map-workspace');
const before=JSON.parse(fs.readFileSync(path.join(dir,'baseline-baseline.json'))).filter(r=>r.width<768);
const after=JSON.parse(fs.readFileSync(path.join(dir,'candidate-baseline.json'))).filter(r=>r.width<768);
assert.deepEqual(after,before,'mobile artwork, selector and search rectangles must match production');
let total=0;
for(const {width,height,mode} of before){
 const a=PNG.sync.read(fs.readFileSync(path.join(dir,`baseline-${width}-${height}-${mode}.png`)));
 const b=PNG.sync.read(fs.readFileSync(path.join(dir,`candidate-${width}-${height}-${mode}.png`)));
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);let pixels=0,maxDelta=0;
 for(let i=0;i<a.data.length;i+=4){let different=false;for(let j=0;j<4;j++){const d=Math.abs(a.data[i+j]-b.data[i+j]);maxDelta=Math.max(maxDelta,d);different ||= d>0;}if(different)pixels++;}
 // Permit only isolated shadow-edge rounding, never a shifted element or changed artwork.
 assert.ok(pixels<=4&&maxDelta<=3,`${width}/${mode}: ${pixels} pixels, max channel delta ${maxDelta}`);
 total+=pixels;console.log('PASS mobile screenshot',width,mode,pixels,'different pixels');
}
console.log(`PASS ${before.length} mobile screenshots; identical rectangles; ${total} isolated rounding pixels total`);
