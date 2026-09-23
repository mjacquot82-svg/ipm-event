import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createTsLoader} from './helpers/load-ts.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const catalog=read('../public/api/vendors.json'),audit=read('../scripts/data/sept22-production-port.json');
const load=createTsLoader(),{tentedCityVendors:map}=load(new URL('../src/data/tentedCityVendors.ts',import.meta.url));
const {resolveVendorMapQuery,vendorMatchesSearch}=load(new URL('../src/config/vendorMapCrosswalk.ts',import.meta.url));
const {footprintForVendor}=load(new URL('../src/config/tentedCityVendorMatch.ts',import.meta.url));
const one=name=>{const rows=catalog.vendors.filter(v=>v.name===name);assert.equal(rows.length,1,name);return rows[0];};
const target=name=>{const r=resolveVendorMapQuery(name);assert.equal(r.status,'mapped',name);return map.find(v=>v.name===r.query);};
test('315 records: 80 additions, 57 approved updates, only three blank duplicate consolidations',()=>{
 assert.equal(catalog.total_count,315);assert.equal(catalog.vendors.length,315);assert.equal(new Set(catalog.vendors.map(v=>v.id)).size,315);
 assert.equal(audit.catalog_additions.length,80);assert.equal(audit.catalog_updates.length,57);assert.equal(audit.duplicate_consolidations.length,3);
 for(const row of [...audit.preserved_production_records,...audit.catalog_additions,...audit.catalog_updates.map(v=>v.after)])assert.deepEqual(catalog.vendors.find(v=>v.id===row.id),row,row.name);
 for(const row of audit.duplicate_consolidations){assert.equal(row.location,'');assert.ok(!catalog.vendors.some(v=>v.id===row.id));assert.equal(catalog.vendors.filter(v=>v.name===row.name).length,1);}
 for(const row of catalog.vendors){assert.equal(typeof row.type,'string');assert.ok('hours_of_operation' in row);assert.ok('days_of_operation' in row);}
 for(const row of audit.catalog_additions){assert.equal(catalog.vendors.filter(v=>v.name.toLowerCase().replace(/[^a-z0-9]/g,'')===row.name.toLowerCase().replace(/[^a-z0-9]/g,'')).length,1,row.name);assert.ok(vendorMatchesSearch(row,row.name));}
});
test('six unresolved groups retain production presence and absence',()=>{
 for(const name of ["Gilligan's Juice Bar",'Brightshores Health System - Saugeen Shores Hospital Foundation'])assert.deepEqual(one(name),audit.preserved_production_records.find(v=>v.name===name));
 for(const re of [/Bellario/i,/Real Time Fun/i,/Doc MacCheesey/i,/RONA/i,/MJ Burnt Creations/i,/WASTE MANAGEMNT/i,/Pronano/i]){assert.ok(!catalog.vendors.some(v=>re.test(v.name)),String(re));assert.ok(!map.some(v=>re.test(v.name)),String(re));}
 assert.ok(!catalog.vendors.some(v=>v.name==='Partnership Park'));assert.equal(map.filter(v=>v.name==='Partnership Park').length,1);
});
test('eight approved replacements retain staging IDs, source locations, and usable existing geometry',()=>{
 for(const [name,location] of [['iLGi Canada','1A 05'],["Chris's Barbeque and Country Style Catering",'5A 23-24'],['Diesel Creek Supply Co','4A 24'],['Ecoflo - Septic Solutions','2A 28'],['Dodge RAM','5A 01-04'],['ENJO Canada','4A 16-21'],['Treemendous Tree Sales & Transplanting','5A 32'],["Women's House Serving Bruce and Grey",'4B 06']]){
  const row=one(name);assert.equal(row.location,location);const change=audit.catalog_updates.find(v=>v.after.name===name);assert.equal(row.id,change.before.id);assert.ok(vendorMatchesSearch(row,name));const fp=footprintForVendor(target(name));if(name==='Dodge RAM')assert.equal(fp,null);else assert.ok(fp,name);
 }
});
test('individually mapped outdoor claims overlap only for the three approved pairs',()=>{
 const allowed=new Set(audit.approved_shared_booths.map(p=>p.names.slice().sort().join('|'))),claims=new Map();
 for(const row of catalog.vendors.filter(v=>v.type!=='Indoor')){
  const r=resolveVendorMapQuery(row.name);if(r.status!=='mapped')continue;const fp=footprintForVendor(map.find(v=>v.name===r.query));
  for(const lot of fp?.lotIds||[]){const existing=claims.get(lot)||[];for(const other of existing)if(other!==row.name)assert.ok(allowed.has([other,row.name].sort().join('|')),lot+': '+other+' / '+row.name);existing.push(row.name);claims.set(lot,existing);}
 }
 for(const {names} of audit.approved_shared_booths){for(const name of names)one(name);assert.deepEqual(footprintForVendor(target(names[0])),footprintForVendor(target(names[1])));}
});
