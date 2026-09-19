/** Scoped overrides from Pennie's explicit 11-vendor list; no map assignments. */
import {readFileSync} from 'node:fs';
export const artisanManifest = JSON.parse(readFileSync(new URL('./data/artisan-tent-vendors-2026.json',import.meta.url),'utf8'));
export const artisanNameKey = name => name.toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]/g,'');
export function applyArtisanVendorUpdates(input) {
  const vendors=input.map(v=>({...v})), results=[];
  for(const target of artisanManifest.vendors) {
    const matches=vendors.filter(v=>artisanNameKey(v.name)===artisanNameKey(target.name));
    const idHit=vendors.find(v=>v.id===target.id);
    if(matches.length>1 || (matches.length===1 && matches[0].id!==target.id) || (idHit && !matches.includes(idHit))) {
      results.push({name:target.name,status:'BLOCKED',reason:'Ambiguous or changed identity'});continue;
    }
    let vendor=matches[0];
    if(!vendor && !target.create_if_absent) {
      results.push({name:target.name,status:'BLOCKED',reason:'Audited existing identity missing'});continue;
    }
    const status=vendor?'MATCHED EXISTING':'CREATED IF TRULY ABSENT';
    const before=vendor? vendor.location:null;
    if(!vendor) {
      vendor={id:target.id,name:target.name,type:'Indoor',location:'',hours_of_operation:'',days_of_operation:'',priority:99};
      vendors.push(vendor);
    }
    vendor.location=artisanManifest.location;
    results.push({id:vendor.id,name:vendor.name,status,before,after:vendor.location});
  }
  return {vendors,results};
}
