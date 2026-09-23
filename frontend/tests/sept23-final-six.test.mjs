import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {createTsLoader} from './helpers/load-ts.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const catalog=read('../public/api/vendors.json'),audit=read('../scripts/data/sept23-final-six-decisions.json');
const load=createTsLoader(),{tentedCityVendors:map}=load(new URL('../src/data/tentedCityVendors.ts',import.meta.url));
const {resolveVendorMapQuery,vendorMatchesSearch}=load(new URL('../src/config/vendorMapCrosswalk.ts',import.meta.url));
const {footprintForVendor}=load(new URL('../src/config/tentedCityVendorMatch.ts',import.meta.url));
const {searchEventMap}=load(new URL('../src/config/mapSearch.ts',import.meta.url));
const {LOT_BY_ID}=load(new URL('../src/config/tentedCityGeometry.ts',import.meta.url));
const baseFile=p=>execFileSync('git',['show',audit.base_sha+':'+p],{encoding:'utf8'});
test('only six authorized decisions change the catalog; existing IDs and unrelated records preserved',()=>{
 const before=JSON.parse(baseFile('frontend/public/api/vendors.json'));
 assert.equal(before.vendors.length,304);assert.equal(catalog.total_count,303);assert.equal(catalog.vendors.length,303);assert.equal(new Set(catalog.vendors.map(v=>v.id)).size,303);
 const touched=new Set([...audit.removed,...audit.updates.map(v=>v.before)].map(v=>v.id));
 for(const old of before.vendors.filter(v=>!touched.has(v.id)))assert.deepEqual(catalog.vendors.find(v=>v.id===old.id),old);
 for(const {before,after} of audit.updates){assert.equal(before.id,after.id);assert.deepEqual(catalog.vendors.find(v=>v.id===before.id),after);}
 assert.equal(audit.additions.length,1);assert.deepEqual(catalog.vendors.find(v=>v.id===audit.additions[0].id),audit.additions[0]);
});
test('cancelled and superseded names have no catalog search results or vendor map matches',()=>{
 for(const name of [...audit.removed,...audit.updates.map(v=>v.before)].map(v=>v.name)){
  assert.equal(catalog.vendors.filter(v=>vendorMatchesSearch(v,name)).length,0,name);
  assert.equal(resolveVendorMapQuery(name).status,'unmapped',name);
  assert.equal(searchEventMap(name,map).filter(hit=>hit.kind==='vendor').length,0,name);
 }
});
for(const [name,lot,search] of [['Bellario Café','4B-10','Bellario'],['Doc MacCheesey','2A-37','Doc MacCheesey'],['MJ Burnt Creations, Mike’s Diecast, Hill Top Farm','4B-29','Hill Top Farm'],['Pronano Solutions','2A-36','Pronano']]){
 test(name+' has exactly one searchable record and the existing booth footprint',()=>{
  const hits=catalog.vendors.filter(v=>vendorMatchesSearch(v,search));assert.equal(hits.length,1);assert.equal(hits[0].name,name);
  assert.ok(vendorMatchesSearch(hits[0],lot.replace('-',' ')));
  assert.deepEqual(searchEventMap(name,map).filter(hit=>hit.kind==='vendor').map(hit=>hit.title),[name]);
  const result=resolveVendorMapQuery(name);assert.equal(result.status,'mapped');const row=map.find(v=>v.name===result.query);
  const fp=footprintForVendor(row);assert.ok(fp);assert.deepEqual(fp.lotIds,[lot]);assert.deepEqual(fp.rects,[LOT_BY_ID.get(lot).rect]);
 });
}
test('all geometry source bytes, unrelated map records and unassigned 2A 38 survive',()=>{
 for(const path of ['frontend/src/data/tented-city-geometry-areas.json','frontend/src/config/tentedCityGeometry.ts'])assert.equal(fs.readFileSync(new URL('../../'+path,import.meta.url),'utf8'),baseFile(path));
 for(const part of [1,2,3]){
  const rows=JSON.parse(baseFile(`frontend/src/data/tentedCityVendorsPart${part}.ts`).split(' = ')[1].replace(/;\s*$/,''));
  for(const row of rows.filter(v=>!audit.map_updates.some(u=>u.before.name===v.name)))assert.deepEqual(map.find(v=>v.name===row.name&&v.locationLabel===row.locationLabel),row);
 }
 assert.ok(LOT_BY_ID.get('2A-38'));assert.ok(!map.some(v=>v.booths.includes('2A-38')));
});
