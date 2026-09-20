import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/config/tentedCityParadeRoutes.ts', import.meta.url),'utf8');
const overlaySource = fs.readFileSync(new URL('../src/components/ParadeRouteOverlay.tsx', import.meta.url),'utf8');
const mod = { exports: {} };
new Function('exports', ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);
const {PARADE_ROUTES: routes, PARADE_VIEWBOX, PARADE_ROAD_EDGES: edges, PARADE_ROAD_CENTERS: centers, PENDING_MUTUAL_SQUARE_SEGMENT: pending, paradePath} = mod.exports;
const {dodge:D,brucePower:B,grainFarmers:G,hydroOne:H,first:F,second:S,fifth:V}=centers;
test('both routes use base map points, assembly entry and approved First Street return', () => {
  assert.equal(PARADE_VIEWBOX,'0 0 774 603');
  for (const route of Object.values(routes)) {
    assert.deepEqual(route.paths[0][0],[503,139]);
    const loop = route.paths[1];
    assert.deepEqual(loop[0],[H,F]);
    assert.deepEqual(loop.at(-1),loop[0]);
    assert.deepEqual(loop[1],[D,F]); // west onto First Street
    for (const path of route.paths) for (const [i,[x,y]] of path.entries()) {
      assert(x>=0 && x<=774 && y>=0 && y<=603);
      if (i) assert(x===path[i-1][0] || y===path[i-1][1]);
    }
    for (const {at:[x,y],direction} of route.arrows) {
      assert(route.paths.some(path => path.slice(1).some(([bx,by],i)=> {
        const [ax,ay]=path[i];
        return direction==='east' ? y===ay && y===by && ax<x && x<bx :
          direction==='west' ? y===ay && y===by && bx<x && x<ax :
          direction==='south' ? x===ax && x===bx && ay<y && y<by :
          x===ax && x===bx && by<y && y<ay;
      })), `${route.id} arrow follows road direction`);
    }
    assert(route.labels.length > 0);
    for (const label of route.labels) {
      assert(route.roads.includes(label.text));
      assert(label.at[0] >= 0 && label.at[0] <= 774 && label.at[1] >= 0 && label.at[1] <= 603);
    }
  }
});
test('Tuesday inner loop preserved; Mutual Square is excluded, not silently interpreted',()=>{
  assert.deepEqual(routes.tuesday.paths[1],[[H,F],[D,F],[D,V],[B,V],[B,S],[G,S],[G,V],[H,V],[H,F]]);
  assert.deepEqual(routes['wed-sat'].paths[1],[[H,F],[D,F],[D,V],[H,V],[H,F]]);
  assert.deepEqual(pending,[[G,313],[H,313]]);
  assert(source.includes('PENDING ORGANIZER CLARIFICATION — CURRENTLY EXCLUDED'));
  assert.equal(paradePath([[1,2],[3,2]]),'M 1 2 L 3 2');
});

test('road centers bisect actual SVG boundary pairs; arrows remain inside corridors', () => {
  const svg=fs.readFileSync(new URL('../assets/images/tented-city-map-app-ready.svg',import.meta.url),'utf8');
  for(const [name,[a,b]] of Object.entries(edges)) {
    assert(svg.includes(String(a)) && svg.includes(String(b)), `${name} boundaries exist in original artwork`);
    assert(Math.abs((centers[name]-a)-(b-centers[name])) < 1e-9);
    assert(b-a>8, `${name} accommodates outlined arrows`);
  }
  for(const route of Object.values(routes)) for(const {at:[x,y],direction} of route.arrows) {
    const vertical=direction==='north'||direction==='south';
    const names=vertical?['dodge','brucePower','grainFarmers','hydroOne']:['first','second','fifth','bruceCountyNorth'];
    const road=names.find(name=>centers[name]===(vertical?x:y));
    assert(road, 'arrow is on measured centerline');
    // Chevron extends 3 points across the road, plus half its 3.8pt outline.
    assert((edges[road][1]-edges[road][0])/2 + 0.1 >= 4.9);
  }
});
test('route presentation keeps labels above the thick blue line', () => {
  assert.match(overlaySource, /stroke-width="6"/);
  assert.match(overlaySource, /fill="white"/);
  assert.match(overlaySource, /paint-order="stroke"/);
  assert.match(overlaySource, /stroke="#003B5C"/);
  assert(overlaySource.indexOf('route.arrows.map') < overlaySource.indexOf('route.labels.map'));
});
