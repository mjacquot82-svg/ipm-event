import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const catalog=JSON.parse(fs.readFileSync(new URL('../public/api/vendors.json',import.meta.url)));
function load(url,overrides={}) {
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 new Function('require','module','exports','fetch','process','setTimeout',code)(name=>{
  if(name==='react-native') return {Platform:{OS:'web'}};
  if(name==='@react-native-async-storage/async-storage') return {getItem:async k=>overrides.cache.get(k)??null,setItem:async(k,v)=>overrides.cache.set(k,v),removeItem:async k=>overrides.cache.delete(k)};
  if(name.endsWith('.json'))return JSON.parse(fs.readFileSync(new URL(name,url)));
  return name.startsWith('.')?load(new URL(name.endsWith('.ts')?name:name+'.ts',url),overrides):require(name);
 },mod,mod.exports,overrides.fetch,{env:{EXPO_PUBLIC_BACKEND_URL:'https://ipm-backend-eoiw.onrender.com'}},(fn,ms)=>setTimeout(fn,ms===1500?0:ms));
 return mod.exports;
}
const api=(fetch,cache=new Map())=>load(new URL('../src/services/spreadsheetDataService.ts',import.meta.url),{fetch,cache});
const {vendorMatchesSearch}=load(new URL('../src/config/vendorMapCrosswalk.ts',import.meta.url));
test('absolute backend configuration cannot bypass canonical web vendor catalog; all five searches resolve',async()=>{
 const urls=[];const result=await api(async url=>{urls.push(url);return {ok:true,json:async()=>catalog};}).getVendorsData();
 assert.deepEqual(urls,['/api/vendors']);assert.equal(result.data.vendors.length,224);assert.equal(new Set(result.data.vendors.map(v=>v.id)).size,224);
 for(const [q,location] of [['CAN-AM','WEST-02'],['Valard','EAST-06'],['Bambrook','1A-05'],['Cottrill','2A-05'],['Ontario Government','3B-19-24']]){
  const matches=result.data.vendors.filter(v=>vendorMatchesSearch(v,q));assert.equal(matches.length,1,q);assert.equal(matches[0].location,location);
 }
});
test('old feed cache cannot finish loading while canonical request is pending',async()=>{
 const cache=new Map([['ipm_supabase_cache:ipm-2026-production:vendors',JSON.stringify({data:{vendors:[]},lastSuccessfulUpdate:new Date().toISOString()})]]);
 let resolve;const response=new Promise(r=>resolve=r);let complete=false;
 const pending=api(()=>response,cache).getVendorsData({preferCache:true}).then(r=>{complete=true;return r;});
 await new Promise(r=>setImmediate(r));assert.equal(complete,false);
 resolve({ok:true,json:async()=>catalog});assert.equal((await pending).data.vendors.length,224);
});
test('offline fallback uses only the canonical cache',async()=>{
 const cache=new Map();await api(async()=>({ok:true,json:async()=>catalog}),cache).getVendorsData();
 const result=await api(async()=>{throw Error('offline');},cache).getVendorsData();assert.equal(result.source,'cache');assert.equal(result.data.vendors.length,224);
});
test('loading renders before no-results and default category is All',()=>{
 const s=fs.readFileSync(new URL('../app/(tabs)/vendors.tsx',import.meta.url),'utf8');
 assert.ok(s.indexOf('if (loading)')<s.indexOf('No Matching Vendors'));assert.match(s,/Loading vendors…/);assert.match(s,/useState<string \| null>\(null\)/);assert.match(s,/setVendors\(result.data.vendors\)/);
});
