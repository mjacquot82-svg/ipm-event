import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createTsLoader } from './helpers/load-ts.mjs';
const load=createTsLoader();
const {tentedCityVendors:map}=load(new URL('../src/data/tentedCityVendors.ts',import.meta.url));
const {resolveVendorMapQuery,vendorMatchesSearch}=load(new URL('../src/config/vendorMapCrosswalk.ts',import.meta.url));
const {footprintForVendor}=load(new URL('../src/config/tentedCityVendorMatch.ts',import.meta.url));
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const catalog=read('../public/api/vendors.json');
const audit=read('../scripts/data/sept22-catalog-reconciliation.json');
const vendors=catalog.vendors;
const key=s=>s.toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]/g,'');
test('September 22 catalog counts, stable IDs, source assignments, and duplicate variants',()=>{
 assert.equal(catalog.total_count,304);assert.equal(vendors.length,304);
 assert.equal(audit.before_count,226);assert.equal(audit.additions.length,78);assert.equal(audit.updates.length,48);
 assert.equal(new Set(vendors.map(v=>v.id)).size,vendors.length);
 for(const expected of [...audit.updates,...audit.additions]){
  const actual=vendors.find(v=>v.id===expected.id);assert.ok(actual,expected.name);
  assert.equal(actual.name,expected.name);assert.equal(actual.location,expected.location);
  assert.ok(vendorMatchesSearch(actual,expected.name),expected.name+' searchable');
 }
 for(const added of audit.additions){
  assert.equal(vendors.filter(v=>key(v.name)===key(added.name)).length,1,added.name);
  const resolution=resolveVendorMapQuery(added.name,added.location);
  assert.equal(resolution.status,'mapped',added.name+' has a single map identity');
 }
 assert.equal(vendors.filter(v=>/de\s*dell/i.test(v.name)).length,1);
 assert.equal(vendors.filter(v=>/metcalf|metalf/i.test(v.name)).length,1);
});
test('confirmed corrections preserve usable map geometry and map search',()=>{
 for(const name of ['Can-Am Demo Area, Montreal, QC','Hometown Street Eats, Drayton','Metcalf Food & Beverage Inc.','Walkerton & District Hospital Foundation','Cottrill Heavy Equipment, Kincardine','Ontario Government']){
  const resolution=resolveVendorMapQuery(name);assert.equal(resolution.status,'mapped',name);
  const target=map.find(v=>v.name===resolution.query);assert.ok(footprintForVendor(target),name);
 }
 const lounge=map.find(v=>v.name==='Hometown Street Eats, Drayton');
 assert.equal(footprintForVendor(lounge).areaId,'named-cknx-centennial-pavilion-lounge-west-3');
 const valard=map.find(v=>/Valard/.test(v.name));assert.equal(valard.locationLabel,'5A 39-42');assert.deepEqual(footprintForVendor(valard).lotIds,['5A-39','5A-40','5A-41','5A-42']);
});
test('shared exhibitors use a whole tent label rather than an invented individual booth',()=>{
 for(const added of audit.additions.filter(v=>v.type==='Indoor')){
  const r=resolveVendorMapQuery(added.name);const target=map.find(v=>v.name===r.query);
  assert.deepEqual(target.booths,[added.location]);assert.equal(target.locationLabel,added.location);
 }
});
test('explicit ambiguity holds and multi-location records remain',()=>{
 for(const [name,location] of [['Bambrook Farm Equipment','1A-05'],['iLGi Canada',''],['Clinton','5A-32'],['Treemendous Tree Sales & Transplanting',''],["Chris's Barbeque and Country Style Catering",''],['K and S Boat and Sled',''],["Gilligan's Juice Bar",'CXD'],['DODGE DEALERS','5A-01-04'],['DC Foods, Tillsonburg','1B-38,4B-12']]){
  assert.equal(vendors.find(v=>v.name===name)?.location,location,name);
 }
 assert.equal(vendors.filter(v=>v.name==='Dairy Farmers of Ontario').length,4);
 assert.equal(vendors.filter(v=>/Beef Farmers of Ontario/.test(v.name)).length,3);
 for(const re of [/Diesel Creek/,/Ecoflo/,/Bellario/,/Partnership Park/,/ENJO Canada/])assert.equal(vendors.filter(v=>re.test(v.name)).length,0,String(re));
});
test('new individually mapped outdoor exhibitors have no overlapping current catalog claims',()=>{
 const mapped=vendors.filter(v=>v.type!=='Indoor').map(v=>{
  const resolved=resolveVendorMapQuery(v.name);const target=resolved.status==='mapped'?map.find(m=>m.name===resolved.query):null;
  return {v,lots:target?footprintForVendor(target)?.lotIds||[]:[]};
 });
 for(const added of audit.additions.filter(v=>v.type!=='Indoor')){
  const own=mapped.find(m=>m.v.id===added.id);assert.ok(own);
  for(const other of mapped.filter(m=>m.v.id!==added.id))assert.equal(own.lots.some(l=>other.lots.includes(l)),false,added.name+' vs '+other.v.name);
 }
});
