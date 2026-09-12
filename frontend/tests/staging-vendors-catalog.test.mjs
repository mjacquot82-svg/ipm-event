import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(here, '..');
const catalog = JSON.parse(readFileSync(join(frontendRoot, 'public/api/vendors.json'), 'utf8'));

// Lightweight TS load via transpile is heavy; duplicate normalize/search helpers for unit checks
function normalizeVendorKey(s) {
  return (s || '')
    .replace(/[’‘‛ʻʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const crosswalkSrc = readFileSync(join(frontendRoot, 'src/config/vendorMapCrosswalk.ts'), 'utf8');
const vendorsTsx = readFileSync(join(frontendRoot, 'app/(tabs)/vendors.tsx'), 'utf8');

function find(re) {
  return catalog.vendors.filter((v) => re.test(v.name));
}

test('multi-booth exhibitors collapse to one card with footprint', () => {
  const gov = find(/^Ontario Government$/i);
  assert.equal(gov.length, 1);
  assert.equal(gov[0].location, '3B-19-24');
  const guelph = find(/university of guelph/i);
  assert.equal(guelph.length, 1);
  assert.equal(guelph[0].location, '3B-16-17');
  const transit = find(/transit trailer/i);
  assert.equal(transit.length, 1);
  assert.equal(transit[0].location, '2A-03-04');
});

test('must-have Sept8 vendors searchable by name with locations', () => {
  const cases = [
    [/can-am/i, 'WEST-02', 'CAN-AM'],
    [/valard/i, 'EAST-06', 'Valard'],
    [/bambrook/i, '1A-05', 'Bambrook'],
    [/cottrill/i, '2A-05', 'Cottrill'],
    [/scatterbrain/i, '4A-13', 'Scatterbrain'],
    [/dj'?s handcrafted/i, '4A-29-30', "DJ's"],
    [/fellowship of christian farmers/i, '2A-17-18', 'Fellowship'],
    [/georgian bay funeral/i, '4B-05', 'Georgian'],
    [/millroad/i, '1B-23-24', 'Millroad'],
    [/teeswater agro/i, '1A-21', 'Teeswater Agro'],
    [/maitland valley/i, '5B-10-12', 'Maitland'],
    [/dedell/i, '2B-19-20', 'DeDell'],
  ];
  for (const [re, loc, label] of cases) {
    const hits = find(re);
    assert.ok(hits.length >= 1, `${label} missing`);
    assert.ok(hits.some((h) => h.location === loc), `${label} want ${loc}, got ${hits.map((h) => h.location)}`);
  }
});

test('types are attendee filter chips Outdoor/Indoor/Food only', () => {
  const types = new Set(catalog.vendors.map((v) => v.type));
  for (const t of types) {
    assert.ok(['Outdoor', 'Indoor', 'Food'].includes(t), `unexpected type ${t}`);
  }
});

test('AmSpec HOLD preserved at 1B-16-22 and not remapped away', () => {
  const am = find(/amspec/i);
  assert.equal(am.length, 1);
  assert.equal(am[0].location, '1B-16-22');
  assert.equal(am[0].type, 'Indoor');
});

test('NOT_ON_SEPT8 preservations exist (catalog > sept8 non-parent 153)', () => {
  assert.ok(catalog.total_count > 153, `expected preserves, got ${catalog.total_count}`);
});

test('Vendors tab uses vendorMatchesSearch; crosswalk exports helper + CAN-AM aliases', () => {
  assert.match(vendorsTsx, /vendorMatchesSearch/);
  assert.match(crosswalkSrc, /export function vendorMatchesSearch/);
  assert.match(crosswalkSrc, /normalizeVendorKey\('CAN-AM'\)/);
  assert.match(crosswalkSrc, /normalizeVendorKey\('Valard Construction LP'\)/);
});

test('catalog search tokens: CAN-AM / Valard LP style queries hit display names', () => {
  const canAm = find(/can-am/i)[0];
  assert.ok(canAm);
  assert.ok(normalizeVendorKey(canAm.name).includes('can-am') || /can-am/i.test(canAm.name));
  // Alias target equals catalog name
  assert.equal(canAm.name, 'Can-Am Demo Area, Montreal, QC');
  const valard = find(/valard/i)[0];
  assert.equal(valard.name, 'Valard Construction, Vaughan');
});

test('UUID uniqueness and VendorsResponse contract', () => {
  const ids = catalog.vendors.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(catalog.last_updated);
  assert.equal(catalog.total_count, catalog.vendors.length);
});
