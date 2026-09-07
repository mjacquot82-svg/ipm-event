import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {checkBinding,sanitize} from '../public/api/production-pilot-binding-check.mjs';
const cap='PRIVATE-CAPABILITY-CANARY'.padEnd(43,'x'),inv='PRIVATE-INVITATION-CANARY'.padEnd(43,'x');
function env(){return {location:{origin:'https://theipm.ca'},localStorage:{getItem:key=>{assert.equal(key,'@ipm_notification_capability_v1');return cap;}},calls:[],async fetch(url,options){this.calls.push({url,options});return {status:200,json:async()=>({diagnostic_status:'CURRENT_GATES_PASS',private:inv})};}};}
test('valid input contacts only read-only route, no binding retry',async()=>{
 const e=env();const r=await checkBinding(inv,e);assert.equal(e.calls.length,1);
 assert.equal(e.calls[0].url,'https://ipm-backend-eoiw.onrender.com/api/production-diagnostics/pilot-binding');
 assert.deepEqual(JSON.parse(e.calls[0].options.body),{invitation:inv});assert.equal(r.request_attempted,true);assert.equal(r.response_received,true);assert.equal(r.http_status,200);
 assert.ok(!JSON.stringify(r).includes(inv));
});
test('detect malformed or whitespace invitation without sending or trimming',async()=>{
 for(const v of ['x'.repeat(64),inv+' ',inv+'\n','']){const e=env();const r=await checkBinding(v,e);assert.equal(r.diagnostic_status,'INVITATION_FORMAT');assert.equal(e.calls.length,0);}
});
test('wrong profile capability and wrong origin are separate local gates',async()=>{
 const e=env();e.localStorage.getItem=()=>null;assert.equal((await checkBinding(inv,e)).diagnostic_status,'CAPABILITY_FORMAT');assert.equal(e.calls.length,0);
 e.location.origin='https://www.theipm.ca';assert.equal((await checkBinding(inv,e)).diagnostic_status,'ORIGIN_REJECTED');
});
test('network failure distinguished from HTTP response and no retry',async()=>{
 const e=env();let n=0;e.fetch=async()=>{n++;throw Error(cap+inv);};const r=await checkBinding(inv,e);assert.equal(n,1);assert.equal(r.request_attempted,true);assert.equal(r.response_received,false);assert.equal(r.diagnostic_status,'READ_UNAVAILABLE');
});
test('server errors secrets and unknown states removed',()=>{
 const r=sanitize({diagnostic_status:inv,invitation_matches:inv,owned_registration_count:inv});assert.ok(!JSON.stringify(r).includes(inv));
});
test('standalone source cannot bind, initialize SDK or mutate browser data',()=>{
 const source=readFileSync(new URL('../public/api/production-pilot-binding-check.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\/bind-pilot|setItem|subscribe\(|unsubscribe\(|requestPermission|console\.|wonderpush|import\s/);
 const html=readFileSync(new URL('../public/api/production-pilot-binding-check.html',import.meta.url),'utf8');assert.doesNotMatch(html,/maxlength=/);assert.match(html,/type="password"/);
});
