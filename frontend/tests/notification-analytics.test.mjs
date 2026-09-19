import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { notificationMetricRows, notificationMissingDetail, metricValue } from '../src/analytics/notificationMetrics.ts';
import { notificationNavigationId } from '../src/analytics/notificationAttribution.ts';
const ref = '00000000-0000-4000-8000-000000000001';
const nav1 = '00000000-0000-4000-8000-000000000002';
const nav2 = '00000000-0000-4000-8000-000000000003';
const history = () => ({state: {router: 'preserved'}, replaceState(value) {this.state = value;}});

test('plain-English rows distinguish exact targets, estimates and gateway sends', () => {
 const rows=Object.fromEntries(notificationMetricRows({provider_targeted_device_count:12,audience_device_count:13,
  provider_sent_count:11,provider_confirmed_receipt_count:9,provider_open_count:3,notification_origin_visit_count:2,provider_failure_count:1}));
 for(const [label,n] of [['Devices targeted',12],['Confirmed receipts',9],['Notification taps',3],['Visits through notification links',2],['Provider-reported delivery failures',1]]) assert.equal(rows[label],String(n));
 assert.ok(!('Estimated available registrations at send time' in rows));
 assert.ok(!('Sent to push service' in rows));
 const estimated=Object.fromEntries(notificationMetricRows({audience_device_count:248}));
 assert.equal(estimated['Estimated available registrations at send time'],'248');
 assert.ok(!('Devices targeted' in estimated));
});
test('unknown remains unavailable while measured zero remains zero', () => {
 for(const value of [null,undefined]) assert.equal(metricValue(value),'Unavailable');
 assert.equal(metricValue(0),'0');
 assert.deepEqual(notificationMetricRows(),[]);
 const historical=notificationMetricRows({status:'sent',provider_accepted:true});
 assert.equal(historical.length,4);
 assert.ok(historical.every(([,value])=>value==='Unavailable'));
 const partial=Object.fromEntries(notificationMetricRows({provider_open_count:0,provider_sent_count:11}));
 assert.equal(partial['Notification taps'],'0');assert.equal(partial['Confirmed receipts'],'Unavailable');
 assert.equal(notificationMissingDetail({}), 'The system does not have reliable evidence for this value.');
});
test('complete detail does not require unsupported exact targets', () => {
 assert.equal(notificationMissingDetail({provider_confirmed_receipt_count:9,provider_open_count:3,
  notification_origin_visit_count:2,provider_failure_count:0}),null);
});
test('notification navigation reload/back remains one visit and preserves router state', () => {
 const h=history();
 assert.equal(notificationNavigationId(ref,h,()=>nav1),nav1);
 assert.equal(notificationNavigationId(ref,h,()=>nav2),nav1);
 assert.equal(h.state.router,'preserved');
 const reloaded=history();reloaded.state=JSON.parse(JSON.stringify(h.state));
 assert.equal(notificationNavigationId(ref,reloaded,()=>nav2),nav1);
});
test('new notification navigation to the same delivery receives a new visit identity', () => {
 assert.equal(notificationNavigationId(ref,history(),()=>nav1),nav1);
 assert.equal(notificationNavigationId(ref,history(),()=>nav2),nav2);
});
test('normal navigation, malformed ref, or unavailable durable history cannot create a visit', () => {
 assert.equal(notificationNavigationId(undefined,history()),null);
 assert.equal(notificationNavigationId('wrong',history()),null);
 assert.equal(notificationNavigationId(ref,undefined),null);
 assert.equal(notificationNavigationId(ref,{replaceState(){throw Error('blocked');}}),null);
});
test('organizer contract has no raw technical identifiers', async () => {
 const service=await readFile(new URL('../src/services/adminAuthService.ts',import.meta.url),'utf8');
 const statsType=service.slice(service.indexOf('export type AnnouncementDeliveryStats ='),service.indexOf('export type AnnouncementDeliveryStatsResponse'));
 assert.doesNotMatch(statsType,/installation_id|push.token|capability_hash|provider_campaign_id|provider_delivery_id/i);
});
test('Expo Router replacing history fields on reload keeps the tab-scoped visit identity', () => {
 const map=new Map();const storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};
 const h=history();h.state={id:'entry-one'};
 assert.equal(notificationNavigationId(ref,h,()=>nav1,storage),nav1);
 h.state={id:'entry-one'};
 assert.equal(notificationNavigationId(ref,h,()=>nav2,storage),nav1);
 h.state={id:'entry-two'};
 assert.equal(notificationNavigationId(ref,h,()=>nav2,storage),nav2);
});
test('router attribution fails closed if tab storage cannot persist', () => {
 assert.equal(notificationNavigationId(ref,{state:{id:'entry'},replaceState(){}},()=>nav1,{getItem(){throw Error('blocked');},setItem(){}}),null);
});
