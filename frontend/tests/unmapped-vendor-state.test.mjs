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
const {EXACT_MAP_UNAVAILABLE,hasTrustedMapGeometry,vendorHasTrustedMapGeometry}=load(new URL('../src/config/mapAvailability.ts',import.meta.url));
const {tentedCityVendors}=load(new URL('../src/data/tentedCityVendors.ts',import.meta.url));
const {vendorMatchesSearch}=load(new URL('../src/config/vendorMapCrosswalk.ts',import.meta.url));
const {findTentedCityPlace,placeRect}=load(new URL('../src/config/tentedCitySearch.ts',import.meta.url));
const {footprintForVendor}=load(new URL('../src/config/tentedCityVendorMatch.ts',import.meta.url));
const catalog=JSON.parse(fs.readFileSync(new URL('../public/api/vendors.json',import.meta.url))).vendors;
for(const [query,location] of [['Valard','EAST-06'],['CAN-AM','WEST-02']])test(`${query} remains searchable with location but no precise map action or fake geometry`,()=>{
 const row=catalog.find(v=>vendorMatchesSearch(v,query));assert.ok(row);assert.equal(row.location,location);
 const place=findTentedCityPlace(row.name,tentedCityVendors);assert.equal(place.kind,'vendor');assert.equal(place.vendor.rect,null);assert.equal(footprintForVendor(place.vendor),null);
 assert.equal(hasTrustedMapGeometry(place),false);assert.equal(vendorHasTrustedMapGeometry(row.name),false);assert.equal(EXACT_MAP_UNAVAILABLE,"Exact map location isn't available yet.");
});
test('MNP approved EAST-2 parent remains trusted',()=>{
 for(const name of ['The Beyond Wireless Stage',"Harley's Pub & Perk - Stage",'Quality Homes - Stage']){
  const place=findTentedCityPlace(name,tentedCityVendors);assert.equal(place.venue.rect,null);assert.equal(place.venue.parentVenueId,'mnp-lifestyles');assert.ok(placeRect(place));assert.equal(hasTrustedMapGeometry(place),true);
 }
});
test('single and multi-booth vendors retain normal map actions',()=>{
 for(const name of ['Bambrook Farm Equipment','Ontario Government','Transit Trailer Ltd'])assert.equal(vendorHasTrustedMapGeometry(name),true,name);
});
test('raw stale geometry cannot make unavailable footprint trusted',()=>{
 const v=tentedCityVendors.find(v=>/Valard/.test(v.name));assert.equal(hasTrustedMapGeometry({kind:'vendor',vendor:{...v,rect:{x:1,y:1,w:5,h:5}}}),false);
 for(const name of ['Hanover','Maitland Valley Conservation'])assert.equal(vendorHasTrustedMapGeometry(name),false);
});
test('canonical known-location scan is limited to eight unavailable records',()=>{
 const rows=catalog.filter(v=>v.location.trim()&&!vendorHasTrustedMapGeometry(v.name));assert.equal(rows.length,8);
 assert.deepEqual(rows.map(v=>v.name),['Bell Cell Tower','Can-Am Demo Area, Montreal, QC','DODGE DEALERS',"Gilligan's Juice Bar",'Hanover','Maitland Valley Conservation','Rogers Cell Tower','Valard Construction, Vaughan']);
});
test('both attendee surfaces show the generic message and map selection clears untrusted parent state',()=>{
 const ui=fs.readFileSync(new URL('../app/(tabs)/vendors.tsx',import.meta.url),'utf8');const map=fs.readFileSync(new URL('../src/components/TentedCityMap.tsx',import.meta.url),'utf8');
 assert.match(ui,/item.location\?\.trim\(\) && !vendorHasTrustedMapGeometry\(item.name\) \? \(/);
 assert.match(ui,/EXACT_MAP_UNAVAILABLE/);assert.match(map,/selectedWithoutGeometry \? <Text[^>]*>\{EXACT_MAP_UNAVAILABLE\}/);
 assert.match(map,/setSelectedSemanticArea\(hasTrustedMapGeometry\(place\) \? semanticArea : null\)/);
});
