import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runReconciliation,snapshot,same} from '../src/services/subscriptionReconciliationCore.ts';
const endpoint='https://push.example.invalid/PRIVATE-CANARY';
function fixture(){
 const forbidden=()=>assert.fail('Forbidden mutation');
 const key=new Uint8Array(65);key[0]=4;
 const subscription={endpoint,expirationTime:null,options:{applicationServerKey:key.buffer},getKey:n=>n==='auth'?new Uint8Array(16).buffer:key.buffer,unsubscribe:forbidden};
 const calls=[];let phase=0;
 const env={online:()=>true,permission:()=> 'granted',capability:()=> 'a'.repeat(43),read:async()=>subscription,
  settle:async()=>{phase=1;},identity:async()=>({installation_id:'b'.repeat(40),local_subscribed:true,user_id:null}),
  request:async body=>{assert.equal(phase,1);calls.push(body);return {status:body.action==='check'?'VERIFYING':'VERIFIED',generation:1};},emit:()=>{},
  subscribe:forbidden,init:forbidden,requestPermission:forbidden,clear:forbidden};
 return {env,subscription,calls};
}
test('exact mismatch recovery protocol confirms only after browser reread; subscription preserved',async()=>{
 const f=fixture();const before=snapshot(f.subscription);const result=await runReconciliation(f.env);
 assert.equal(result.status,'VERIFIED');assert.deepEqual(f.calls.map(c=>c.action),['check','confirm']);assert.ok(same(before,snapshot(f.subscription)));
 assert.equal(JSON.stringify(result).includes(endpoint),false);
});
test('SDK settling happens before comparison; healthy result has no mutation phase',async()=>{
 const f=fixture();f.env.request=async body=>{f.calls.push(body);return {status:'VERIFIED',generation:1};};
 assert.equal((await runReconciliation(f.env)).status,'VERIFIED');assert.equal(f.calls.length,1);
});
for(const timing of ['before-check','during-check','during-confirm']) test('rotation '+timing,async()=>{
 const f=fixture();let reads=0;const old=f.env.read;
 f.env.read=async()=>{reads++;if(timing==='before-check' && reads===2)f.subscription.endpoint+='rotated';return old();};
 f.env.request=async body=>{f.calls.push(body);if((timing==='during-check' && body.action==='check')||(timing==='during-confirm'&&body.action==='confirm'))f.subscription.endpoint+='rotated';return {status:body.action==='check'?'VERIFYING':'VERIFIED',generation:1};};
 const result=await runReconciliation(f.env);
 if(timing==='before-check'){assert.equal(result.status,'VERIFIED');assert.ok(f.calls[0].subscription.data.endsWith('rotated'));}
 else{assert.equal(result.status,'CHECK_DUE');assert.equal(f.calls.at(-1).action,'invalidate');}
});
for(const [name,change,state] of [
 ['offline',f=>f.env.online=()=>false,'OFFLINE_PENDING'],
 ['permission',f=>f.env.permission=()=> 'denied','INELIGIBLE'],
 ['capability',f=>f.env.capability=()=>null,'IDENTITY_UNRESOLVED'],
 ['missing-subscription',f=>f.env.read=async()=>null,'INELIGIBLE'],
 ['identity',f=>f.env.identity=async()=>null,'IDENTITY_UNRESOLVED'],
 ['optout',f=>f.env.identity=async()=>({installation_id:'b'.repeat(40),local_subscribed:false,user_id:null}),'INELIGIBLE'],
]) test(name+' never requests repair',async()=>{const f=fixture();change(f);assert.equal((await runReconciliation(f.env)).status,state);assert.equal(f.calls.length,0);});
test('response and exception canaries sanitized',async()=>{
 const f=fixture();f.env.request=async()=>({status:endpoint,secret:endpoint,generation:endpoint});
 assert.equal(JSON.stringify(await runReconciliation(f.env)).includes(endpoint),false);
 f.env.request=async()=>{throw new Error(endpoint);};assert.equal((await runReconciliation(f.env)).status,'DEFERRED');
});
test('permission lost after request cannot be VERIFIED',async()=>{
 const f=fixture();f.env.request=async()=>{f.env.permission=()=> 'denied';return {status:'VERIFYING',generation:1};};
 assert.equal((await runReconciliation(f.env)).status,'INELIGIBLE');
});
test('coordination uses Web Locks, bounded retries and strict staging gate',()=>{
 const wrapper=readFileSync(new URL('../src/services/subscriptionReconciliation.web.ts',import.meta.url),'utf8');
 assert.match(wrapper,/navigator\.locks\.request/);assert.match(wrapper,/if\(inFlight\) return inFlight/);
 assert.match(wrapper,/retries<3/);assert.match(wrapper,/30000,120000,600000/);
 assert.match(wrapper,/location.origin==='https:\/\/staging.theipm.ca'/);
 assert.doesNotMatch(wrapper,/\.subscribe\(|\.unsubscribe\(|\.register\(|\.clear\(|\.init\(|subscribeToNotifications\(/);
});

test('automatic recovery cannot enter legacy replacement or enrollment',()=>{
 const service=readFileSync(new URL('../src/services/notificationRegistration.web.ts',import.meta.url),'utf8');
 assert.match(service,/!options\.allowEnrollment \|\| hasExistingReconciliationCapability\(\)/);
 assert.match(service,/readWonderPushSnapshot\(\{requireInstallation:true\}\)/);
 const component=readFileSync(new URL('../src/components/NotificationOptIn.tsx',import.meta.url),'utf8');
 assert.match(component,/completeSetup = useCallback\(async \(allowEnrollment = false\)/);
 assert.match(component,/nextState === 'subscribed'\) await completeSetup\(true\)/);
});
