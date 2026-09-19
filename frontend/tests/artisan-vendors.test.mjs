import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {artisanManifest,applyArtisanVendorUpdates,artisanNameKey} from '../scripts/artisan-vendor-updates.mjs';
const catalog=JSON.parse(readFileSync(new URL('../public/api/vendors.json',import.meta.url))).vendors;
const original=JSON.parse(readFileSync(new URL('../scripts/data/production-vendors-snapshot.json',import.meta.url))).vendors;
test('exactly 11 named artisans, nine existing IDs/fields preserved, two genuinely new identities',()=>{
 assert.equal(artisanManifest.vendors.length,11);
 assert.equal(artisanManifest.vendors.filter(v=>v.create_if_absent).length,2);
 for(const t of artisanManifest.vendors) {
  const matches=catalog.filter(v=>artisanNameKey(v.name)===artisanNameKey(t.authority_name));assert.equal(matches.length,1);
  const [v]=matches;assert.equal(v.id,t.id);assert.equal(v.location,'Indoors at the Artisan Tent');
  const old=original.find(v=>v.id===t.id);
  if(!t.create_if_absent){assert(old);assert.deepEqual({...v,location:old.location},old);}
  else assert(!old);
 }
 assert.equal(catalog.filter(v=>v.location===artisanManifest.location).length,11);
 assert.equal(new Set(catalog.map(v=>v.id)).size,catalog.length);
});
test('rerun is idempotent and unrelated records are byte-for-byte preserved',()=>{
 const result=applyArtisanVendorUpdates(catalog);assert.deepEqual(result.vendors,catalog);
 const ids=new Set(artisanManifest.vendors.map(v=>v.id));
 for(const v of catalog.filter(v=>!ids.has(v.id)))assert.deepEqual(result.vendors.find(r=>r.id===v.id),v);
});
test('punctuation variations reuse identity; ambiguous individual does not block other artisans',()=>{
 const target=artisanManifest.vendors.find(v=>v.name==="Mike's Wood");
 const input=catalog.map(v=>v.id===target.id?{...v,name:'Mike’s Wood',location:''}:{...v});
 assert.equal(applyArtisanVendorUpdates(input).results.find(v=>v.id===target.id).status,'MATCHED EXISTING');
 input.push({...input.find(v=>v.id===target.id),id:'different-id'});
 const result=applyArtisanVendorUpdates(input);
 assert.equal(result.results.filter(r=>r.status==='BLOCKED').length,1);
 assert.equal(result.vendors.find(v=>v.id===target.id).location,'');
 assert.equal(result.results.filter(r=>r.status==='MATCHED EXISTING').length,10);
});
