import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, file);
const approved = require('../src/data/approvedIndoorExhibitors.json');
const catalog = require('../public/api/vendors.json').vendors;
const { tentedCityVendors } = require('../src/data/tentedCityVendors.ts');
const { resolveVendorMapQuery, vendorMatchesSearch } = require('../src/config/vendorMapCrosswalk.ts');
const { footprintForVendor } = require('../src/config/tentedCityVendorMatch.ts');
const { applyApprovedIndoorExhibitors } = require('../src/data/approvedIndoorExhibitorMap.ts');
test('68 additions with unique stable IDs; existing 228 retained; three CarePartners activities', () => {
  assert.equal(approved.length, 68);
  assert.equal(catalog.length, 296);
  assert.equal(createHash('sha256').update(JSON.stringify(catalog.slice(0, 228))).digest('hex'), '1d80517752554f1dff4a89af68166a5355580f4672a83f095eb9ec71456654da');
  assert.equal(new Set(catalog.map(v => v.id)).size, 296);
  assert.equal(new Set(approved.map(v => v.name)).size, 68);
  assert.equal(approved.filter(v => v.name.startsWith('CarePartners -')).length, 3);
  assert.deepEqual(applyApprovedIndoorExhibitors(tentedCityVendors), tentedCityVendors);
});
for (const entry of approved) test(`${entry.name}: search, location, exact map target and containing footprint`, () => {
  const records = catalog.filter(v => v.name === entry.name);
  assert.equal(records.length, 1);
  assert.equal(records[0].location, entry.location);
  assert.equal(records[0].type, 'Indoor');
  assert.ok(vendorMatchesSearch(records[0], entry.name));
  const resolved = resolveVendorMapQuery(entry.name, entry.location);
  assert.deepEqual(resolved, { status: 'mapped', query: entry.name });
  const mapped = tentedCityVendors.filter(v => v.name === resolved.query);
  assert.equal(mapped.length, 1);
  for (const legacy of entry.replacesMapNames) {
    if (legacy !== entry.name) assert.equal(tentedCityVendors.filter(v => v.name === legacy).length, 0, 'legacy map duplicate removed');
  }
  assert.deepEqual(mapped[0].booths, [entry.area]);
  const footprint = footprintForVendor(mapped[0]);
  assert.ok(footprint, 'existing canonical geometry must resolve');
  assert.ok(footprint.lotIds.length === 0 || footprint.lotIds.length >= 6, 'never one invented stall');
  const sameArea = approved.find(v => v.area === entry.area);
  assert.deepEqual(footprint.rect, footprintForVendor(tentedCityVendors.find(v => v.name === sameArea.name)).rect);
});
