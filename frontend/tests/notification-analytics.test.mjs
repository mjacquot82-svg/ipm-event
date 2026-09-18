import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { notificationMetricRows, notificationMissingDetail, metricValue } from '../src/analytics/notificationMetrics.ts';
import { notificationNavigationId } from '../src/analytics/notificationAttribution.ts';
const ref = '00000000-0000-4000-8000-000000000001';
const nav1 = '00000000-0000-4000-8000-000000000002';
const nav2 = '00000000-0000-4000-8000-000000000003';
const history = () => ({state: {router: 'preserved'}, replaceState(value) {this.state = value;}});

test('provider fixture maps every count and acceptance to precise UI labels', () => {
 const rows = Object.fromEntries(notificationMetricRows({status:'sent', provider_accepted:true,
  audience_device_count:13, provider_targeted_device_count:12, provider_sent_count:11,
  provider_confirmed_receipt_count:9, provider_open_count:3, notification_origin_visit_count:2, provider_failure_count:1}));
 for(const [label,n] of [['Known deliverable devices at send',13],['Targeted devices',12],['Sent to push service',11],['Provider-confirmed receipts',9],['Notification opens',3],['Notification-origin app visits',2],['Provider failures',1]]) assert.equal(rows[label],String(n));
 assert.ok(!Object.keys(rows).some(x=>/delivered|people/i.test(x)));
});
test('absent sends are compact; historical missing telemetry is summarized, never zero', () => {
 for(const value of [null,undefined]) assert.equal(metricValue(value),'Not available');
 assert.equal(metricValue(0),'0');
 assert.deepEqual(notificationMetricRows(),[]);
 const historical={status:'sent',provider_accepted:true,provider_sent_count:null};
 assert.deepEqual(notificationMetricRows(historical),[]);
 assert.equal(notificationMissingDetail(historical),'Detailed delivery analytics are not available for this send.');
});
test('partial statistics retain explicit zero and collapse missing counts', () => {
 const stats={status:'sent',provider_accepted:true,provider_open_count:0,provider_sent_count:11};
 assert.deepEqual(notificationMetricRows(stats),[['Notification opens','0'],['Sent to push service','11']]);
 assert.equal(notificationMissingDetail(stats),'Additional delivery analytics are not available.');
});
test('complete statistics need no unavailable explanation', () => {
 assert.equal(notificationMissingDetail({provider_targeted_device_count:12,provider_confirmed_receipt_count:9,
 provider_open_count:3,notification_origin_visit_count:2,provider_failure_count:0,provider_sent_count:11}),null);
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
