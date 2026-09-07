import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { repairExistingSubscription } from './repair.mjs';
const RESULT = 'CURRENT_BROWSER_SUBSCRIPTION_MATCHES_PROVIDER';
const origin = 'https://staging.theipm.ca';
function fixture() {
  const key = new Uint8Array(65); key[0] = 4;
  const forbidden = () => assert.fail('Forbidden initialization or mutation');
  const subscription = { endpoint: 'https://push.example.invalid/current', expirationTime: null,
    getKey: name => name === 'auth' ? new Uint8Array(16).buffer : key.buffer,
    options: { applicationServerKey: key.buffer }, unsubscribe: forbidden };
  let reads = 0;
  const registration = { scope: origin + '/', active: { scriptURL: origin + '/webpushr-sw.js?private-test-key' },
    update: forbidden, unregister: forbidden, pushManager: { subscribe: forbidden,
      getSubscription: async () => { reads++; return subscription; } } };
  const calls = [];
  const env = { location: { origin }, crypto: webcrypto, Notification: { permission: 'granted', requestPermission: forbidden },
    navigator: { serviceWorker: { register: forbidden, getRegistration: async () => registration } },
    WonderPush: { init: forbidden, subscribeToNotifications: forbidden },
    localStorage: { getItem: () => 'a'.repeat(43), setItem: forbidden, removeItem: forbidden, clear: forbidden },
    fetch: async (url, options) => { calls.push({url, options}); return { ok:true, json: async () => ({
      repair_status: 'MATCH_VERIFIED', [RESULT]: true, endpoint_match: true, p256dh_match:true, auth_match:true,
      application_server_key_match:true, secret: subscription.endpoint }) }; } };
  return {env, subscription, registration, calls, reads: () => reads};
}
test('one private request preserves existing subscription with no init, subscribe, storage writes or raw output', async () => {
  const f = fixture();
  const output = await repairExistingSubscription(f.env);
  assert.equal(output[RESULT], true); assert.equal(output.browser_subscription_preserved, true);
  assert.equal(f.calls.length,1); assert.equal(f.reads(),2);
  const {url,options} = f.calls[0];
  assert.equal(options.method,'POST'); assert.equal(options.credentials,'omit'); assert.equal(options.redirect,'error');
  assert.equal(new URL(url).search,'');
  const body=JSON.parse(options.body);
  assert.deepEqual(Object.keys(body.subscription).sort(), ['applicationServerKey','auth','data','p256dh']);
  for(const secret of [f.subscription.endpoint, 'a'.repeat(43), ...Object.values(body.comparison.digests)])
    assert.equal(JSON.stringify(output).includes(secret),false);
});
test('production, missing capability, permission, missing subscription and unrelated worker refuse without API call', async () => {
  const variants = [f=>f.env.location.origin='https://theipm.ca', f=>f.env.localStorage.getItem=()=>null,
    f=>f.env.Notification.permission='denied', f=>f.registration.pushManager.getSubscription=async()=>null,
    f=>f.registration.active.scriptURL=origin+'/unrelated.js', f=>f.subscription.expirationTime=1];
  for(const change of variants) { const f=fixture(); change(f); assert.equal((await repairExistingSubscription(f.env))[RESULT],'unverifiable'); assert.equal(f.calls.length,0); }
});
test('network failure has no retry or exception disclosure', async () => {
  const f=fixture(); let calls=0;
  f.env.fetch=async()=>{calls++;throw new Error(f.subscription.endpoint);};
  const output=await repairExistingSubscription(f.env);
  assert.equal(calls,1);assert.equal(output[RESULT],'unverifiable');assert.equal(JSON.stringify(output).includes(f.subscription.endpoint),false);
});
test('concurrent browser subscription change cannot produce a current match',async()=>{
  const f=fixture();let calls=0;
  f.registration.pushManager.getSubscription=async()=>++calls===1?f.subscription:{...f.subscription,endpoint:'https://push.example.invalid/changed'};
  const output=await repairExistingSubscription(f.env);
  assert.equal(output.browser_subscription_preserved,false);assert.equal(output[RESULT],'unverifiable');
});
test('malformed provider result and arbitrary error enum are sanitized',async()=>{
  const f=fixture();f.env.fetch=async()=>({ok:true,json:async()=>({repair_status:f.subscription.endpoint,[RESULT]:true})});
  const output=await repairExistingSubscription(f.env);
  assert.equal(output.repair_status,'UNVERIFIABLE');assert.equal(output[RESULT],'unverifiable');
});
test('standalone page has one deliberate action and no application boot',()=>{
  const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
  const page=readFileSync(new URL('./page.mjs',import.meta.url),'utf8');
  assert.equal((html.match(/<script/g)||[]).length,1);
  assert.doesNotMatch(html,/wonderpush-loader|expo|iframe/);
  assert.match(page,/once: true/);assert.match(page,/button.disabled = true/);
});
