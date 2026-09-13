import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const path='frontend/src/components/GroundsTrafficOverlay.tsx';
const source=readFileSync(new URL('../src/components/GroundsTrafficOverlay.tsx',import.meta.url),'utf8');
const original=execFileSync('git',['show',`0c1b1d8abce2bbfb262f90647b6b8c64b111324c:${path}`],{encoding:'utf8'});
test('physical-review refinement freezes all traffic coordinates, arrow rendering and casing',()=>{
 const coordinates=s=>s.split('export const GROUNDS_TRAFFIC_ARROWS = ')[1].split('] as const;')[0];
 const rendering=s=>s.split('{GROUNDS_TRAFFIC_ARROWS.map')[1].split('    })}')[0];
 assert.equal(coordinates(source),coordinates(original));assert.equal(rendering(source),rendering(original));
 for(const style of ['casing','shaft','head','headFill'])assert.equal(source.match(new RegExp(`  ${style}:.*`))[0],original.match(new RegExp(`  ${style}:.*`))[0]);
});
test('one passive explanatory caption and deliberate shared-style road orientations',()=>{
 assert.equal((source.match(/>Flow of traffic</g)||[]).length,1);
 assert.match(source,/pointerEvents="none" testID="grounds-flow-caption"/);
 for(const [name,angle] of [['Durham Rd',90],['Greenock-Brant',0],['Bruce Road 2',90],['Bruce Road 3',0]])assert.match(source,new RegExp(`<RoadLabel text="${name}"[^\n]*rotation=\\{${angle}\\}`));
 assert.doesNotMatch(source,/rotation=\{(?:-10|80)\}/);
 assert.doesNotMatch(source,/withTiming|withRepeat|withSpring|Touchable|Pressable|Traffic Flow|Concession 2|Highway 9/);
 assert.equal(source.match(/  labelText:.*\n/)[0],original.match(/  labelText:.*\n/)[0]);
});
test('Walkerton and exact barricade wording remain unchanged',()=>{
 assert.equal(source.match(/export const GROUNDS_TRAFFIC_NOTICE = .*;/)[0],original.match(/export const GROUNDS_TRAFFIC_NOTICE = .*;/)[0]);
 const walkerton=s=>s.split('testID="grounds-walkerton"')[1].split('</View>')[0];assert.equal(walkerton(source),walkerton(original));
 assert.equal(source.match(/  orientation:.*\n/)[0],original.match(/  orientation:.*\n/)[0]);
});
