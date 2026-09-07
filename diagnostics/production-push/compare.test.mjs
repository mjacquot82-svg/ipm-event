import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {compareCurrentSubscription,digestSubscription,safeResult} from './compare.mjs';
const key = n => Uint8Array.from({length:n},(_,i)=>n===65&&i===0?4:7).buffer;
const sub = {endpoint:'https://push.example/ENDPOINT_CANARY',getKey:n=>key(n==='auth'?16:65),options:{applicationServerKey:key(65)}};
const BOOLS=['production_registration_identified','browser_subscription_present','browser_provider_match','endpoint_match','p256dh_match','auth_match','application_server_key_match','configured_test_target_matches_current_registration','provider_opt_in','provider_has_push_token','provider_os_notifications_visible'];
const good={...Object.fromEntries(BOOLS.map(k=>[k,true])),configured_test_target_count:1,provider_update_at:'2026-09-07T20:15:00.000Z',diagnostic_status:'COMPARED'};
function env({rotate=false,missing=false,reject=false}={}) {
 const calls=[];let reads=0;
 return {calls,location:{origin:'https://theipm.ca'},crypto:webcrypto,localStorage:{getItem:()=> 'C'.repeat(43)},
 navigator:{serviceWorker:{getRegistration:async()=>({active:{},scope:'https://theipm.ca/',pushManager:{getSubscription:async()=>{
 reads++;return missing?null:rotate&&reads>1?{...sub,endpoint:'https://push.example/new'}:sub;
 }}})}},fetch:async(url,options)=>{calls.push({url,options});if(reject)throw Error('PRIVATE_CANARY');return {ok:true,json:async()=>({...good,secret:'PRIVATE_CANARY'})};}};
}
test('canonical encoding matches backend HMAC protocol',async()=>{
 const challenge=new Uint8Array(32).fill(171);const p=await digestSubscription(sub,challenge,webcrypto);
 const expected=createHmac('sha256',challenge).update('ipm-subscription-compare-v1\0endpoint\0').update(sub.endpoint).digest('hex');
 assert.equal(p.digests.endpoint,expected);
});
test('existing subscription read twice; only one non-mutating diagnostic request; safe output',async()=>{
 const e=env();const r=await compareCurrentSubscription(e);assert.deepEqual(r,good);assert.equal(e.calls.length,1);
 const {options}=e.calls[0];assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
 assert.equal(options.method,'POST');assert.equal(options.cache,'no-store');
 assert.ok(!options.body.includes(sub.endpoint));assert.ok(!options.body.includes('C'.repeat(43)));
 assert.ok(!JSON.stringify(r).includes('CANARY'));
});
test('rotation invalidates equality without retry',async()=>{
 const e=env({rotate:true});const r=await compareCurrentSubscription(e);
 assert.equal(r.browser_provider_match,'unverifiable');assert.equal(r.diagnostic_status,'BROWSER_CHANGED');assert.equal(e.calls.length,1);
});
test('no subscription performs no backend call',async()=>{
 const e=env({missing:true});assert.equal((await compareCurrentSubscription(e)).browser_subscription_present,false);assert.equal(e.calls.length,0);
});
test('network failure never retries or echoes exception',async()=>{
 const e=env({reject:true});const r=await compareCurrentSubscription(e);assert.equal(e.calls.length,1);assert.ok(!JSON.stringify(r).includes('CANARY'));
});
test('missing capability or wrong origin never calls provider',async()=>{
 const e=env();e.localStorage.getItem=()=>null;assert.equal((await compareCurrentSubscription(e)).diagnostic_status,'CAPABILITY_UNAVAILABLE');
 e.location.origin='https://staging.theipm.ca';assert.equal((await compareCurrentSubscription(e)).diagnostic_status,'WRONG_ORIGIN');assert.equal(e.calls.length,0);
});
test('malformed key rejected without request',async()=>{
 await assert.rejects(digestSubscription({...sub,getKey:()=>key(1)},new Uint8Array(32),webcrypto));
});
test('safe response projection cannot expose raw payload or partial match',()=>{
 const r=safeResult({...good,endpoint_match:'secret',secret:'CANARY',provider_update_at:'CANARY',diagnostic_status:'CANARY'});
 assert.equal(r.browser_provider_match,'unverifiable');assert.ok(!JSON.stringify(r).includes('CANARY'));
});
test('standalone page build inputs contain no mutation/SDK/app loading',()=>{
 const js=readFileSync(new URL('./compare.mjs',import.meta.url),'utf8');
 for(const pattern of [/\.subscribe\s*\(/,/\.unsubscribe\s*\(/,/requestPermission\s*\(/,/\.register\s*\(/,/\.setItem\s*\(/,/\.removeItem\s*\(/,/WonderPush\./,/console\./])assert.ok(!pattern.test(js));
 const html=readFileSync(new URL('./production-push-diagnostic.html',import.meta.url),'utf8');
 assert.equal((html.match(/<script/g)||[]).length,1);assert.ok(html.includes('./production-push-compare.mjs'));
 assert.ok(html.includes("default-src 'none'"));assert.ok(!html.includes('staging'));
});
