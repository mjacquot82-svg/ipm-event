import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createTsLoader} from './helpers/load-ts.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const catalog=read('../public/api/vendors.json'),audit=read('../scripts/data/sept22-source-replacements.json');
const load=createTsLoader(),{tentedCityVendors:map}=load(new URL('../src/data/tentedCityVendors.ts',import.meta.url));
const {resolveVendorMapQuery,vendorMatchesSearch}=load(new URL('../src/config/vendorMapCrosswalk.ts',import.meta.url));
const {footprintForVendor}=load(new URL('../src/config/tentedCityVendorMatch.ts',import.meta.url));
test('four source replacements preserve IDs, consolidate blanks, and retain exact existing geometry',()=>{
 assert.equal(catalog.total_count,303);assert.equal(catalog.vendors.length,303);assert.equal(new Set(catalog.vendors.map(v=>v.id)).size,303);
 assert.equal(audit.updates.length,4);assert.equal(audit.removed_duplicates.length,2);assert.equal(audit.remaining_unresolved.length,6);
 for(const {before,after} of audit.updates){
  assert.equal(after.id,before.id);assert.deepEqual(catalog.vendors.find(v=>v.id===before.id),after);
  assert.equal(catalog.vendors.filter(v=>v.name===after.name).length,1);assert.ok(!catalog.vendors.some(v=>v.name===before.name));assert.ok(vendorMatchesSearch(after,after.name));
  const resolved=resolveVendorMapQuery(after.name);assert.equal(resolved.status,'mapped');const row=map.find(v=>v.name===resolved.query);const old=audit.map_updates.find(v=>v.after.name===after.name).before;
  assert.deepEqual(row.rect,old.rect);assert.deepEqual(row.booths,old.booths);assert.deepEqual(footprintForVendor(row),footprintForVendor(old));assert.ok(footprintForVendor(row));assert.equal(map.filter(v=>v.name===after.name).length,1);
 }
 for(const dup of audit.removed_duplicates)assert.ok(!catalog.vendors.some(v=>v.id===dup.id));
});
