import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const path='frontend/src/components/GroundsTrafficOverlay.tsx';
const source=readFileSync(new URL('../src/components/GroundsTrafficOverlay.tsx',import.meta.url),'utf8');
const original=execFileSync('git',['show',`f87e5ed0a0363bc92724e18180a8ed14d86e1041:${path}`],{encoding:'utf8'});
test('physical-review refinement freezes all traffic coordinates, arrow rendering and casing',()=>{
 const coordinates=s=>s.split('export const GROUNDS_TRAFFIC_ARROWS = ')[1].split('] as const;')[0];
 const rendering=s=>s.split('{GROUNDS_TRAFFIC_ARROWS.map')[1].split('    })}')[0];
 assert.equal(coordinates(source),coordinates(original));assert.equal(rendering(source),rendering(original));
 for(const style of ['casing','shaft','head','headFill'])assert.equal(source.match(new RegExp(`  ${style}:.*`))[0],original.match(new RegExp(`  ${style}:.*`))[0]);
});
test('one passive explanatory caption and deliberate shared-style road orientations',()=>{
 assert.equal((source.match(/>Flow of traffic</g)||[]).length,1);
 assert.match(source,/pointerEvents="none" testID="grounds-flow-caption"/);
 for(const [name,angle] of [['Durham Rd',90],['Greenock-Brant',0],['Bruce Road 2',90],['Bruce Road 3',0],['Highway 9',90]])assert.match(source,new RegExp(`<RoadLabel text="${name}"[^\n]*rotation=\\{${angle}\\}`));
 assert.doesNotMatch(source,/rotation=\{(?:-10|80)\}/);
 assert.doesNotMatch(source,/withTiming|withRepeat|withSpring|Touchable|Pressable|Traffic Flow|Concession 2/);
 assert.equal(source.match(/  labelText:.*\n/)[0],original.match(/  labelText:.*\n/)[0]);
});
test('Walkerton and exact barricade wording remain unchanged',()=>{
 assert.equal(source.match(/export const GROUNDS_TRAFFIC_NOTICE = .*;/)[0],original.match(/export const GROUNDS_TRAFFIC_NOTICE = .*;/)[0]);
 assert.match(source,/top: height \* \.16 - 10/); assert.match(source,/>↑ Walkerton</);
 assert.equal(source.match(/  orientation:.*\n/)[0],original.match(/  orientation:.*\n/)[0]);
});

test('final positioning uses a yellow route caption and source-supported road labels',()=>{
 assert.match(source,/flowCaption:.*backgroundColor: '#FFE600'/);
 assert.match(source,/left: width \* \.215 - 75, top: height \* \.73 - 10/);
 assert.match(source,/<RoadLabel text="Durham Rd" x=\{41.5\} y=\{82\}/);
 assert.equal((source.match(/<RoadLabel text="Bruce Road 3"/g)||[]).length,1);
 assert.equal((source.match(/<RoadLabel text="Highway 9"/g)||[]).length,1);
 assert.match(source,/<RoadLabel text="Bruce Road 2"[^\n]*zoomOnly/);
 assert.doesNotMatch(source,/<RoadLabel text="(?:Bruce Road 3|Highway 9)"[^\n]*zoomOnly/);
});

test('polish freezes road labels, Walkerton and yellow-area source geometry',()=>{
 assert.deepEqual(source.match(/    <RoadLabel[^\n]+/g),original.match(/    <RoadLabel[^\n]+/g));
 const walk=s=>s.split('testID="grounds-walkerton"')[1].split('</View>')[0];assert.equal(walk(source),walk(original));
 for(const p of ['frontend/src/config/groundsZones.ts','frontend/assets/images/grounds-site-map.jpg'])assert.deepEqual(readFileSync(new URL('../'+p.replace('frontend/',''),import.meta.url)),execFileSync('git',['show',`f87e5ed0a0363bc92724e18180a8ed14d86e1041:${p}`]));
});
test('notice moves into passive artwork overlay without closure geometry',()=>{
 const map=readFileSync(new URL('../src/components/GroundsMap.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(map,/grounds-traffic-notice|GROUNDS_TRAFFIC_NOTICE/);
 assert.equal((source.match(/testID="grounds-traffic-notice"/g)||[]).length,1);
 assert.match(source,/pointerEvents="none" testID="grounds-traffic-notice"/);
 assert.match(source,/pointerEvents="none" testID="grounds-horse-plowing-label"/);
 assert.doesNotMatch(source,/barricade-pin|closure|Polyline|Polygon|Marker/);
});
