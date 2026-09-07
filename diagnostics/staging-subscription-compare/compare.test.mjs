import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compareCurrentSubscription, digestSubscription, safeResult, unverifiable, ORIGIN, RESULT } from './compare.mjs';
const sensitive = 'https://push.example.invalid/test-only-endpoint';
function fixture() {
 const calls=[]; const key=new Uint8Array(65);key[0]=4;
 const subscription={endpoint:sensitive,getKey:name=>name==='auth'?new Uint8Array(16).buffer:key.buffer,options:{applicationServerKey:key.buffer}};
 const forbidden=()=>assert.fail('Mutation or initialization attempted');
 const env={location:{origin:ORIGIN},crypto:webcrypto,
  navigator:{serviceWorker:{register:forbidden,getRegistration:async()=>({scope:ORIGIN+'/',active:{},update:forbidden,
   pushManager:{subscribe:forbidden,getSubscription:async()=>subscription}})}},
  WonderPush:{init:forbidden,subscribeToNotifications:forbidden},
  localStorage:new Proxy({}, {get:forbidden}),
  fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({[RESULT]:true,endpoint_match:true,p256dh_match:true,auth_match:true,application_server_key_match:true,unexpected:sensitive})};},
 };
 return {env,calls,subscription};
}
test('only existing subscription read, no init/subscribe/storage, one request, safe result',async()=>{
 const {env,calls}=fixture(); const result=await compareCurrentSubscription(env);
 assert.equal(result[RESULT],true);assert.equal(calls.length,1);
 assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.credentials,'omit');
 assert.equal(calls[0].options.redirect,'error');
 assert.equal(calls[0].options.body.includes(sensitive),false);
 const body=JSON.parse(calls[0].options.body);
 assert.deepEqual(Object.keys(body).sort(),['challenge','digests']);
 assert.equal(body.challenge.length,64);
 assert.equal(JSON.stringify(result).includes(sensitive),false);
 assert.equal(JSON.stringify(result).includes(body.challenge),false);
 for(const digest of Object.values(body.digests))assert.equal(JSON.stringify(result).includes(digest),false);
});
test('production cannot read browser or call backend',async()=>{
 const env=new Proxy({location:{origin:'https://theipm.ca'}},{get(target,key){assert.equal(key,'location');return target[key];}});
 assert.deepEqual(await compareCurrentSubscription(env),unverifiable());
});
test('missing application server key is unverifiable; no partial comparison request',async()=>{
 const {env,calls,subscription}=fixture();subscription.options.applicationServerKey=null;
 assert.deepEqual(await compareCurrentSubscription(env),unverifiable());assert.equal(calls.length,0);
});
test('no subscription is unverifiable without provider call',async()=>{
 const {env,calls}=fixture();env.navigator.serviceWorker.getRegistration=async()=>({scope:ORIGIN+'/',active:{},pushManager:{getSubscription:async()=>null}});
 assert.deepEqual(await compareCurrentSubscription(env),unverifiable());assert.equal(calls.length,0);
});
test('read failures never retry or return errors with sensitive material',async()=>{
 const {env,calls}=fixture();env.fetch=async()=>{calls.push(1);throw new Error(sensitive);};
 assert.deepEqual(await compareCurrentSubscription(env),unverifiable());assert.equal(calls.length,1);
});
test('all true / one false / inconsistent / incomplete response classification',()=>{
 const body={[RESULT]:false,endpoint_match:true,p256dh_match:true,auth_match:false,application_server_key_match:true};
 assert.equal(safeResult(body)[RESULT],false);
 assert.deepEqual(safeResult({...body,[RESULT]:true}),unverifiable());
 delete body.auth_match;assert.deepEqual(safeResult(body),unverifiable());
 assert.deepEqual(safeResult({[RESULT]:sensitive}),unverifiable());
});
test('fresh challenges produce different digests without exposing endpoint or keys',async()=>{
 const {subscription}=fixture();
 const first=await digestSubscription(subscription,new Uint8Array(32).fill(1),webcrypto);
 const second=await digestSubscription(subscription,new Uint8Array(32).fill(2),webcrypto);
 for(const name of Object.keys(first.digests))assert.notEqual(first.digests[name],second.digests[name]);
});
test('isolated page loads only comparison module and button is one-shot',()=>{
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 assert.equal((html.match(/<script/g)||[]).length,1);
 assert.doesNotMatch(html,/wonderpush-loader|expo|webKey|iframe/);
 const page=readFileSync(new URL('./page.mjs',import.meta.url),'utf8');
 assert.match(page,/once: true/);assert.match(page,/button.disabled = true/);
});
