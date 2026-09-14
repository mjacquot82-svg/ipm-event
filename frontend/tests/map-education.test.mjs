import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const cache=new Map();
function load(url){
 if(cache.has(url.href))return cache.get(url.href).exports;
 const mod={exports:{}};cache.set(url.href,mod);
 const code=ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',code)(n=>n.endsWith('.json')?JSON.parse(fs.readFileSync(new URL(n,url))):load(new URL(n+'.ts',url)),mod,mod.exports);return mod.exports;
}
const {scheduleMapTipEligible,vendorMapTipEligible}=load(new URL('../src/services/mapEducationEligibility.ts',import.meta.url));
const {EDUCATION_KEYS,MAP_TOUR_STEPS}=load(new URL('../src/services/mapEducationState.ts',import.meta.url));
test('five steps in order use actual control anchors and explanatory final card',()=>{
 assert.deepEqual(MAP_TOUR_STEPS.map(s=>s.target),['parking','tented','rv','search','grounds']);
 assert.match(MAP_TOUR_STEPS[4].body,/Events and vendors.*Find on Map/);
});
test('three learning states have independent versioned persistence keys',()=>{
 assert.equal(new Set(Object.values(EDUCATION_KEYS)).size,3);
 assert.deepEqual(Object.keys(EDUCATION_KEYS),['mapsTourSeen','scheduleFindOnMapTipSeen','vendorFindOnMapTipSeen']);
});
test('Schedule education only accompanies a usable existing destination',()=>{
 for(const [location,title] of [['The Beyond Wireless Stage',''],['Plowing Fields','Tractor Plowing'],['Plowing Fields','Horse Plowing'],['CKNX Centennial Pavilion (GFO Stage)',''],['Event Centre #1 — West 2','']]) assert.equal(scheduleMapTipEligible(location,title),true,location);
 for(const location of [null,'','Unknown unmapped test location','Parade route coming soon','Valard','CAN-AM'])assert.equal(scheduleMapTipEligible(location),false,String(location));
});
test('Vendor education excludes unavailable and empty destinations without touching routing',()=>{
 for(const name of ['Bambrook Farm Equipment','Ontario Government','Transit Trailer Ltd'])assert.equal(vendorMapTipEligible(name),true,name);
 for(const name of ['Valard','CAN-AM','Hanover','Maitland Valley Conservation','Unknown test vendor',''])assert.equal(vendorMapTipEligible(name),false,name);
});
test('education adds no animation, network requests, preference reset or navigation',()=>{
 const ui=fs.readFileSync(new URL('../src/components/MapEducation.tsx',import.meta.url),'utf8');
 assert.match(ui,/animationType="none"/);assert.match(ui,/AsyncStorage.setItem\(EDUCATION_KEYS\[kind\], 'true'\)/);
 assert.doesNotMatch(ui,/fetch\(|router\.|setMode\(|setGroundsView\(|removeItem\(|AsyncStorage.clear/);
});
