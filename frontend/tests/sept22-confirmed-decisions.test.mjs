import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createTsLoader} from './helpers/load-ts.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const catalog=read('../public/api/vendors.json').vendors,audit=read('../scripts/data/sept22-confirmed-decisions.json');
const load=createTsLoader(),{tentedCityVendors:map}=load(new URL('../src/data/tentedCityVendors.ts',import.meta.url));
const {resolveVendorMapQuery,vendorMatchesSearch}=load(new URL('../src/config/vendorMapCrosswalk.ts',import.meta.url));
const {footprintForVendor}=load(new URL('../src/config/tentedCityVendorMatch.ts',import.meta.url));
const one=name=>{const hits=catalog.filter(v=>v.name===name);assert.equal(hits.length,1,name);return hits[0];};
const target=name=>{const hit=resolveVendorMapQuery(name);assert.equal(hit.status,'mapped',name);return map.find(v=>v.name===hit.query);};
test('only the confirmed catalog changes, restored ENJO ID and duplicate consolidation',()=>{
 assert.equal(catalog.length,306);assert.equal(new Set(catalog.map(v=>v.id)).size,306);
 for(const {before,after} of audit.updates){assert.equal(before.id,after.id);assert.deepEqual(one(after.name),after);}
 for(const expected of audit.additions)assert.deepEqual(one(expected.name),expected);
 assert.equal(one('ENJO Canada').id,'64319171-ef84-58ee-b1f9-00189522f700');
 assert.equal(one('Dodge RAM').id,'5041c4ee-0da8-5174-b73c-2451f95aa2ac');
 assert.equal(one('Treemendous Tree Sales & Transplanting').id,'d9e22660-ba30-5f2e-a36d-91888a9f2cc7');
 assert.equal(one("Women's House Serving Bruce and Grey").id,'380ac022-0c50-43fa-8580-e4493f794556');
 assert.ok(!catalog.some(v=>v.id===audit.removed_duplicate.id));
 for(const name of ['Clinton','Kincardine','DODGE DEALERS','ENJO Chemical Free Cleaning System','Partnership Park'])assert.ok(!catalog.some(v=>v.name===name),name);
 assert.equal(audit.remaining_unresolved.length,10);
});
test('three approved shared booths retain both searchable exhibitors and the same footprint',()=>{
 for(const {location,names} of audit.approved_shared_booths){
  const footprints=names.map(name=>{const row=one(name);assert.equal(row.location.replace(/ /g,'-'),location.replace(/ /g,'-'));assert.ok(vendorMatchesSearch(row,name));const fp=footprintForVendor(target(name));assert.ok(fp,name);return fp;});
  assert.deepEqual(footprints[0].lotIds,footprints[1].lotIds);assert.deepEqual(footprints[0].rects,footprints[1].rects);
 }
});
test('resolved replacements use existing geometry; Dodge does not invent unavailable stalls',()=>{
 for(const [name,location] of [['ENJO Canada','4A 16-21'],['Treemendous Tree Sales & Transplanting','5A 32'],["Women's House Serving Bruce and Grey",'4B 06']]){
  assert.equal(one(name).location,location);assert.equal(target(name).locationLabel,location);assert.ok(footprintForVendor(target(name)),name);
 }
 assert.equal(one('Dodge RAM').location,'5A 01-04');assert.equal(footprintForVendor(target('Dodge RAM')),null);
 assert.ok(vendorMatchesSearch(one('Dodge RAM'),'DODGE DEALERS'));
 assert.ok(vendorMatchesSearch(one('ENJO Canada'),'ENJO Chemical Free Cleaning System'));
 assert.equal(map.filter(v=>v.name==='Partnership Park').length,1);
});
test('all other ambiguity groups remain unchanged',()=>{
 for(const [name,location] of [['Bambrook Farm Equipment','1A-05'],['iLGi Canada',''],["Chris's Barbeque and Country Style Catering",''],["Gilligan's Juice Bar",'CXD'],['Brightshores Health System - Saugeen Shores Hospital Foundation',''],['Premier Tech Water & Environment','2A-28'],['Real Time Fun and Rentals','4B-10'],['WASTE MANAGEMNT','4B-29']])assert.equal(one(name).location,location,name);
 for(const name of ['Bellario Café','Diesel Creek Supply Co','Doc MacCheesey','Ecoflo - Septic Solutions',"MJ Burnt Creations, Mike's Diecast, Hill Top Farm",'Pronano Solutions'])assert.ok(!catalog.some(v=>v.name===name),name);
});
test('outdoor booth sharing is limited to the three approved pairs and preserved same-exhibitor entries',()=>{
 const allowed=new Set(audit.approved_shared_booths.map(p=>p.names.slice().sort().join('|'))),claims=new Map();
 for(const row of catalog.filter(v=>v.type!=='Indoor')){
  const resolved=resolveVendorMapQuery(row.name);if(resolved.status!=='mapped')continue;
  const fp=footprintForVendor(map.find(v=>v.name===resolved.query));
  for(const lot of fp?.lotIds||[]){const existing=claims.get(lot)||[];for(const other of existing)if(other!==row.name)assert.ok(allowed.has([other,row.name].sort().join('|')),lot+': '+other+' / '+row.name);existing.push(row.name);claims.set(lot,existing);}
 }
});
