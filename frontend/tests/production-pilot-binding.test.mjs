import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindPilot} from '../public/api/production-pilot-binding.mjs';
const capability='PRIVATE-CAPABILITY-CANARY'.padEnd(43,'x');
const invitation='PRIVATE-INVITATION-CANARY'.padEnd(43,'x');
const ok={bound:true,pilot_restriction_count:1,observation_enabled:false,repair_enabled:false};
function env(result=ok){
 const calls=[];
 return {calls,location:{origin:'https://theipm.ca'},localStorage:{getItem(key){assert.equal(key,'@ipm_notification_capability_v1');return capability;}},async fetch(url,options){calls.push({url,options});return {ok:true,json:async()=>({...result,private:capability})};}};
}
test('reuses diagnostic capability, single POST, sanitized output',async()=>{
 const e=env();const r=await bindPilot(invitation,e);assert.deepEqual(r,ok);assert.equal(e.calls.length,1);
 assert.equal(e.calls[0].options.headers['X-Notification-Device-Capability'],capability);
 assert.deepEqual(JSON.parse(e.calls[0].options.body),{invitation});
 assert.ok(!e.calls[0].url.includes(invitation));assert.ok(!JSON.stringify(r).includes(capability));
});
test('wrong origin/missing capability/invalid invitation do not contact backend',async()=>{
 for(const kind of ['origin','capability','invitation']){
  const e=env();if(kind==='origin')e.location.origin='https://staging.theipm.ca';
  if(kind==='capability')e.localStorage.getItem=()=>null;
  assert.deepEqual(await bindPilot(kind==='invitation'?'bad':invitation,e),{bound:false});assert.equal(e.calls.length,0);
 }
});
test('network ambiguity no retry and no secret returned',async()=>{
 const e=env();let calls=0;e.fetch=async()=>{calls++;throw Error(invitation+capability);};
 assert.deepEqual(await bindPilot(invitation,e),{bound:false});assert.equal(calls,1);
});
test('consumed invitation or switches on never reported success',async()=>{
 for(const result of [{bound:false},{...ok,observation_enabled:true},{...ok,repair_enabled:true}])
  assert.deepEqual(await bindPilot(invitation,env(result)),{bound:false});
});
test('standalone page no SDK, app import, subscription or storage mutation',()=>{
 const source=readFileSync(new URL('../public/api/production-pilot-binding.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/setItem|subscribe\(|unsubscribe\(|requestPermission|console\.|wonderpush|import\s/);
 const html=readFileSync(new URL('../public/api/production-pilot-binding.html',import.meta.url),'utf8');
 assert.match(html,/type="password"/);assert.match(html,/form-action 'none'/);
 assert.match(source,/input.value = ''/);assert.match(source,/\.disabled = true/);
});
