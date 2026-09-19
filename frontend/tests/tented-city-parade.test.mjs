import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/config/tentedCityParadeRoutes.ts', import.meta.url),'utf8');
const mod = { exports: {} };
new Function('exports', ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);
const {PARADE_ROUTES: routes, PARADE_VIEWBOX, PENDING_MUTUAL_SQUARE_SEGMENT: pending, paradePath} = mod.exports;
test('both routes use base map points, assembly entry and approved First Street return', () => {
  assert.equal(PARADE_VIEWBOX,'0 0 774 603');
  for (const route of Object.values(routes)) {
    assert.deepEqual(route.paths[0][0],[503,139]);
    const loop = route.paths[1];
    assert.deepEqual(loop[0],[444,192]);
    assert.deepEqual(loop.at(-1),loop[0]);
    assert.deepEqual(loop[1],[142,192]); // west onto First Street
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
  }
});
test('Tuesday inner loop preserved; Mutual Square is excluded, not silently interpreted',()=>{
  assert.deepEqual(routes.tuesday.paths[1],[[444,192],[142,192],[142,437],[241,437],[241,247.5],[344,247.5],[344,437],[444,437],[444,192]]);
  assert.deepEqual(routes['wed-sat'].paths[1],[[444,192],[142,192],[142,437],[444,437],[444,192]]);
  assert.deepEqual(pending,[[344,313],[444,313]]);
  assert(source.includes('PENDING ORGANIZER CLARIFICATION — CURRENTLY EXCLUDED'));
  assert.equal(paradePath([[1,2],[3,2]]),'M 1 2 L 3 2');
});
