import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {createTsLoader} from './helpers/load-ts.mjs';
const base='6f043b35491abfec6b9bbf62ce31d36c105fc0f9';
const staging='30674d2b409bda9b3b9ba53f404bad4e56129cc3';
const source=(ref,path)=>execFileSync('git',['show',`${ref}:${path}`],{encoding:'utf8'});
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const before=JSON.parse(source(base,'frontend/public/api/vendors.json'));
const catalog=read('../public/api/vendors.json');
const approved=JSON.parse(source(staging,'frontend/scripts/data/sept23-final-six-decisions.json'));
const additions=[...approved.updates.map(u=>u.after),...approved.additions];
const load=createTsLoader();
const {tentedCityVendors:map}=load(new URL('../src/data/tentedCityVendors.ts',import.meta.url));
const {resolveVendorMapQuery,vendorMatchesSearch}=load(new URL('../src/config/vendorMapCrosswalk.ts',import.meta.url));
const {searchEventMap}=load(new URL('../src/config/mapSearch.ts',import.meta.url));
const {footprintForVendor}=load(new URL('../src/config/tentedCityVendorMatch.ts',import.meta.url));
const {LOT_BY_ID}=load(new URL('../src/config/tentedCityGeometry.ts',import.meta.url));
test('production patch contains only two removals and four exact approved additions',()=>{
 assert.equal(before.total_count,315);assert.equal(catalog.total_count,317);assert.equal(catalog.vendors.length,317);
 assert.equal(new Set(catalog.vendors.map(v=>v.id)).size,317);
 const removed=new Set(approved.removed.map(v=>v.id));
 assert.deepEqual(catalog.vendors.filter(v=>!additions.some(a=>a.id===v.id)),before.vendors.filter(v=>!removed.has(v.id)));
 for(const row of additions)assert.deepEqual(catalog.vendors.filter(v=>v.id===row.id),[row]);
});
for(const row of approved.removed){
 test(row.name+' is cancelled with no exhibitor-specific catalog/map search reference',()=>{
  assert.ok(!catalog.vendors.some(v=>v.id===row.id));
  assert.equal(catalog.vendors.filter(v=>vendorMatchesSearch(v,row.name)).length,0);
  assert.equal(resolveVendorMapQuery(row.name).status,'unmapped');
  assert.equal(searchEventMap(row.name,map).filter(h=>h.kind==='vendor').length,0);
 });
}
for(const [name,lot] of [['Bellario Café','4B-10'],['Doc MacCheesey','2A-37'],['MJ Burnt Creations, Mike’s Diecast, Hill Top Farm','4B-29'],['Pronano Solutions','2A-36']]){
 test(name+' uses the approved staging ID and existing production booth geometry',()=>{
  const row=additions.find(v=>v.name===name);assert.ok(row);
  assert.deepEqual(catalog.vendors.filter(v=>vendorMatchesSearch(v,name)),[row]);
  const result=resolveVendorMapQuery(name);assert.equal(result.status,'mapped');
  const matches=map.filter(v=>v.name===result.query);assert.equal(matches.length,1);
  const fp=footprintForVendor(matches[0]);assert.ok(fp);assert.deepEqual(fp.lotIds,[lot]);assert.deepEqual(fp.rects,[LOT_BY_ID.get(lot).rect]);
  assert.deepEqual(searchEventMap(name,map).filter(h=>h.kind==='vendor').map(h=>h.title),[name]);
 });
}
test('superseded occupant identities stay absent; 2A 38 stays unassigned',()=>{
 for(const name of ['Real Time Fun and Rentals','RONA Doidge Kincardine, Kincardine','WASTE MANAGEMNT']){
  assert.equal(catalog.vendors.filter(v=>vendorMatchesSearch(v,name)).length,0);
  assert.equal(resolveVendorMapQuery(name).status,'unmapped');
  assert.equal(searchEventMap(name,map).filter(h=>h.kind==='vendor').length,0);
 }
 assert.ok(LOT_BY_ID.get('2A-38'));
 assert.ok(!map.some(v=>footprintForVendor(v)?.lotIds.includes('2A-38')));
});
test('unrelated production map records and geometry sources are unchanged',()=>{
 const addedNames=new Set(additions.map(v=>v.name));
 for(const part of [1,2,3]){
  const path=`frontend/src/data/tentedCityVendorsPart${part}.ts`;
  const parse=s=>JSON.parse(s.split(' = ')[1].replace(/;\s*$/,''));
  assert.deepEqual(parse(fs.readFileSync(new URL('../../'+path,import.meta.url),'utf8')).filter(v=>!addedNames.has(v.name)),parse(source(base,path)));
 }
 for(const path of ['frontend/src/data/tented-city-geometry-areas.json','frontend/src/config/tentedCityGeometry.ts','frontend/src/data/tentedCityVendorsConsolidated.ts','frontend/src/services/spreadsheetDataService.ts']){
  assert.equal(fs.readFileSync(new URL('../../'+path,import.meta.url),'utf8'),source(base,path),path);
 }
});
