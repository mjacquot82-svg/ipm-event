import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function firstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('missing ' + paths.join(' | '));
}

const geoPath = firstExisting([
  path.join(root, 'src/data/tented-city-geometry-areas.json'),
  path.join(root, 'src/data/tented-city-geometry.json'),
  path.join(root, 'data/tented-city-geometry.json'),
]);
const reportPath = firstExisting([
  path.join(root, 'src/data/tented-city-vendor-match-report.json'),
  path.join(root, 'data/tented-city-vendor-match-report.json'),
]);
const matchPath = firstExisting([
  path.join(root, 'src/config/tentedCityVendorMatch.ts'),
  path.join(root, 'config/tentedCityVendorMatch.ts'),
]);
const mapPath = firstExisting([
  path.join(root, 'src/components/TentedCityMap.tsx'),
  path.join(root, 'components/TentedCityMap.tsx'),
]);
const vendorPath = firstExisting([
  path.join(root, 'src/data/tentedCityVendorsPart1.ts'),
  path.join(root, 'data/tentedCityVendorsPart1.ts'),
]);


function round3(n) { return Math.round(n * 1000) / 1000; }
function ptsToPercentRect(pt) {
  return { x: round3(pt.x / 774 * 100), y: round3(pt.y / 603 * 100), w: round3(pt.w / 774 * 100), h: round3(pt.h / 603 * 100) };
}
function formatLotId(section, n) { return section + '-' + String(n).padStart(2, '0'); }
function lotsForArea(area) {
  const n = area.n_lots || 0;
  const start = area.lot_start;
  const pts = area.rect_pts;
  if (!n || start == null || !pts || !area.section) return [];
  const lots = [];
  if (area.split_axis === 'B_to_T') {
    const h = pts.h / n;
    for (let i = 0; i < n; i += 1) {
      const num = start + i;
      const y = pts.y + pts.h - (i + 1) * h;
      lots.push({ id: formatLotId(area.section, num), parent: area.label, n: num, rect: ptsToPercentRect({ x: pts.x, y, w: pts.w, h }), flagged: area.flagged });
    }
    return lots;
  }
  const w = pts.w / n;
  for (let i = 0; i < n; i += 1) {
    const num = start + i;
    const x = pts.x + i * w;
    lots.push({ id: formatLotId(area.section, num), parent: area.label, n: num, rect: ptsToPercentRect({ x, y: pts.y, w, h: pts.h }), flagged: area.flagged });
  }
  return lots;
}

const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
geo.lots = (geo.areas || []).flatMap(lotsForArea);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const lots = Object.fromEntries(geo.lots.map((l) => [l.id, l]));
const areas = Object.fromEntries(geo.areas.map((a) => [a.label, a]));

test('affine mapping is page percent, not a crop offset', () => {
  assert.match(geo.mapping.formula, /pt_x \/ 774 \* 100/);
  assert.match(geo.mapping.formula, /pt_y \/ 603 \* 100/);
  const a9pts = { x: 208.479, y: 158.397, w: 5.866, h: 23.802 };
  assert.equal(round3((a9pts.x / 774) * 100), 26.935);
  assert.equal(round3((a9pts.y / 603) * 100), 26.268);
  assert.equal(round3((a9pts.w / 774) * 100), 0.758);
  assert.equal(round3((a9pts.h / 603) * 100), 3.947);
});

test('1A-09 PDF percents sit on the official PNG (not the old eyeballed grid)', () => {
  const a9 = lots['1A-09'];
  assert.ok(a9);
  assert.equal(a9.rect.x, 26.935);
  assert.equal(a9.rect.y, 26.268);
  assert.equal(a9.rect.w, 0.758);
  assert.equal(a9.rect.h, 3.947);
  const parent = areas['1A 1-12'];
  assert.equal(parent.n_lots, 12);
  assert.equal(a9.rect.y, parent.rect.y);
  assert.ok(a9.rect.x > parent.rect.x);
  assert.ok(a9.rect.x + a9.rect.w < parent.rect.x + parent.rect.w);
});

test('5A 5-12 is 8 lots starting at 5 and 5A-01 does not exist', () => {
  const block = areas['5A 5-12'];
  assert.equal(block.n_lots, 8);
  assert.equal(block.lot_start, 5);
  assert.equal(block.lot_end, 12);
  const ids = geo.lots.filter((l) => l.parent === '5A 5-12').map((l) => l.id).sort();
  assert.deepEqual(ids, ['5A-05', '5A-06', '5A-07', '5A-08', '5A-09', '5A-10', '5A-11', '5A-12']);
  assert.equal(lots['5A-01'], undefined);
  assert.equal(lots['5A-04'], undefined);
  assert.ok(lots['5A-05']);
  assert.ok(lots['5A-12']);
});

test('6B 26-29 is flagged and not a confident individual-lot source', () => {
  const block = areas['6B 26-29'];
  assert.equal(block.flagged, true);
  assert.equal(block.n_lots, 4);
  assert.equal(block.orientation, 'vertical');
  for (const id of ['6B-26', '6B-27', '6B-28', '6B-29']) {
    assert.equal(lots[id].flagged, true);
  }
  const matchSrc = fs.readFileSync(matchPath, 'utf8');
  assert.match(matchSrc, /6B-26-29-numbering-unproven/);
  assert.match(matchSrc, /5A-01-04-do-not-exist/);
  assert.match(matchSrc, /3B-07-12-bruce-power-named-tent/);
});

test('ACE / JCB at 1A-09 is confident_lot with PDF rect', () => {
  const vendors = fs.readFileSync(vendorPath, 'utf8');
  assert.match(vendors, /ACE \/ JCB, Harriston/);
  assert.match(vendors, /"locationLabel":"1A-09"/);
  assert.equal(report.ace.name, 'ACE / JCB, Harriston');
  assert.equal(report.ace.class, 'confident_lot');
  assert.equal(report.ace.locationLabel, '1A-09');
  assert.deepEqual(report.ace.rect, { x: 26.935, y: 26.268, w: 0.758, h: 3.947 });
});

test('matcher totals cover every vendor', () => {
  const t = report.totals;
  assert.equal(t.confident_lot, 230);
  assert.equal(t.range_or_named, 49);
  assert.equal(t.ambiguous, 3);
  assert.equal(t.unmatched, 3);
  assert.equal(t.confident_lot + t.range_or_named + t.ambiguous + t.unmatched, report.vendor_count);
  assert.equal(report.vendor_count, 285);
  assert.ok(report.classes.ambiguous.includes('Hanover'));
  assert.ok(report.classes.ambiguous.includes('Dodge RAM'));
  assert.ok(report.classes.range_or_named.includes('Bruce Power, Tiverton'));
  assert.ok(report.classes.unmatched.includes('Wroxeter'));
});

test('normalize 1A-09 variants in the matcher', () => {
  const src = fs.readFileSync(matchPath, 'utf8');
  assert.match(src, /parseLotToken/);
  assert.match(src, /1A-09 \/ 1A 09 \/ 1A-9 \/ 1A09/);
  assert.match(src, /formatLotId/);
});

test('TentedCityMap uses footprintForVendor and does not draw all lots', () => {
  const map = fs.readFileSync(mapPath, 'utf8');
  assert.match(map, /footprintForVendor/);
  assert.match(map, /TENTED_CITY_VERIFY_PARENTS/);
  assert.doesNotMatch(map, /footprintFor1AVendor/);
  assert.doesNotMatch(map, /TENTED_CITY_1A_LOTS/);
  assert.match(map, /styles.footprint/);
  assert.match(map, /onSwitchToGrounds/);
  assert.match(map, /MAP_SOURCE/);
  assert.match(map, /tented-city-map\.png/);
  assert.match(map, /map location not available/);
});


test('3B-07-12 vendors map to the named Bruce Power tent, not invented lots', () => {
  const matchSrc = fs.readFileSync(matchPath, 'utf8');
  assert.match(matchSrc, /isBrucePowerSlot/);
  assert.match(matchSrc, /named-bruce-power-nuclear-energy-group/);
  assert.equal(lots['3B-07'], undefined);
  assert.equal(lots['3B-12'], undefined);
  const tent = geo.areas.find((a) => a.id === 'named-bruce-power-nuclear-energy-group');
  assert.ok(tent);
  assert.equal(tent.n_lots, 0);
  assert.deepEqual(tent.rect, { x: 24.363, y: 52.744, w: 5.604, h: 3.947 });
  assert.equal(report.bruce_power_named_tent.vendor_count, 13);
  assert.equal(report.ace.class, 'confident_lot');
  assert.deepEqual(report.ace.rect, { x: 26.935, y: 26.268, w: 0.758, h: 3.947 });
});
test('1A 13-24 is separated from 1A 1-12 by the avenue gap', () => {
  const a = areas['1A 1-12'].rect;
  const b = areas['1A 13-24'].rect;
  assert.ok(b.x - (a.x + a.w) > 2, 'avenue gap should exist; do not abut copied 1A widths');
});

const geoTsPath = firstExisting([
  path.join(root, 'src/config/tentedCityGeometry.ts'),
  path.join(root, 'config/tentedCityGeometry.ts'),
]);

function loadExhibitors() {
  const dir = firstExisting([
    path.join(root, 'src/data'),
    path.join(root, 'data'),
  ]);
  const rows = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.startsWith('tentedCityVendorsPart') && f.endsWith('.ts')).sort()) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const start = text.indexOf('= [') + 2;
    const end = text.lastIndexOf(']') + 1;
    rows.push(...JSON.parse(text.slice(start, end)));
  }
  return rows;
}

function rectsAbut(a, b, gap = 0.25) {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return overlapX >= -gap && overlapY >= -gap;
}

function unionOf(rects) {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const rgt = Math.max(...rects.map((r) => r.x + r.w));
  const bot = Math.max(...rects.map((r) => r.y + r.h));
  return { x: round3(x), y: round3(y), w: round3(rgt - x), h: round3(bot - y) };
}

function connectedComponents(rects) {
  const n = rects.length;
  const seen = Array(n).fill(false);
  const comps = [];
  for (let i = 0; i < n; i += 1) {
    if (seen[i]) continue;
    const stack = [i];
    seen[i] = true;
    const comp = [];
    while (stack.length) {
      const k = stack.pop();
      comp.push(rects[k]);
      for (let j = 0; j < n; j += 1) {
        if (!seen[j] && rectsAbut(rects[k], rects[j])) {
          seen[j] = true;
          stack.push(j);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

function clusterLotRects(lotObjs) {
  const byParent = new Map();
  for (const lot of lotObjs) {
    const list = byParent.get(lot.parent) || [];
    list.push(lot.rect);
    byParent.set(lot.parent, list);
  }
  const clusters = [];
  for (const rects of byParent.values()) {
    for (const comp of connectedComponents(rects)) clusters.push(unionOf(comp));
  }
  return clusters;
}

const allVendors = loadExhibitors();

test('lotsConnected rejects a street gap / different parent', () => {
  const geoSrc = fs.readFileSync(geoTsPath, 'utf8');
  assert.match(geoSrc, /clusterLotRects/);
  assert.match(geoSrc, /Never union across a street/);
  assert.doesNotMatch(geoSrc, /u\.w < 20 && u\.h < 12/);
  assert.doesNotMatch(geoSrc, /4\.5 \* s/);
  const a = lots['4A-16'].rect;
  const b = lots['4B-17'].rect;
  const u = unionOf([a, b]);
  assert.ok(u.h > a.h + 1, 'union of 4A+4B includes Fourth Street');
  assert.equal(rectsAbut(a, b), false);
});

test('Agilec clusters into two tight range rects, not the road union', () => {
  const agilec = allVendors.find((v) => v.name === 'Agilec Employment Services, Wingham');
  assert.ok(agilec);
  const lotObjs = agilec.booths.map((id) => lots[id]);
  assert.equal(lotObjs.length, 12);
  const clusters = clusterLotRects(lotObjs);
  assert.equal(clusters.length, 2);
  const parents = new Set(lotObjs.map((l) => l.parent));
  assert.deepEqual([...parents].sort(), ['4A 13-24', '4B 13-24']);
  const a = unionOf(lotObjs.filter((l) => l.parent === '4A 13-24').map((l) => l.rect));
  const b = unionOf(lotObjs.filter((l) => l.parent === '4B 13-24').map((l) => l.rect));
  const painted = clusters.slice().sort((p, q) => p.y - q.y);
  assert.deepEqual(painted[0], a);
  assert.deepEqual(painted[1], b);
  const roadUnion = unionOf(clusters);
  assert.ok(roadUnion.h > a.h + b.h, 'union includes the street gap');
  for (const c of clusters) {
    assert.ok(Math.abs(c.h - a.h) < 0.05 || Math.abs(c.h - b.h) < 0.05);
    assert.ok(c.w < 6, 'cluster is stalls only, not the whole 13-24 block');
  }
});

test('ACE / JCB stays a single 1A-09 stall', () => {
  const ace = allVendors.find((v) => v.name === 'ACE / JCB, Harriston');
  const lotObjs = ace.booths.map((id) => lots[id]);
  assert.equal(lotObjs.length, 1);
  const clusters = clusterLotRects(lotObjs);
  assert.equal(clusters.length, 1);
  assert.deepEqual(clusters[0], lots['1A-09'].rect);
  assert.deepEqual(clusters[0], { x: 26.935, y: 26.268, w: 0.758, h: 3.947 });
});

test('every bundled exhibitor with mapped lots paints one rect per cluster', () => {
  let multi = 0;
  for (const vendor of allVendors) {
    const lotObjs = (vendor.booths || []).map((id) => lots[id]).filter(Boolean);
    if (!lotObjs.length) continue;
    const clusters = clusterLotRects(lotObjs);
    const parents = new Set(lotObjs.map((l) => l.parent));
    assert.ok(clusters.length >= 1, vendor.name);
    if (parents.size > 1) {
      multi += 1;
      assert.ok(clusters.length >= parents.size, vendor.name + ' must not union across parents');
    }
  }
  assert.ok(multi >= 20, `expected many rural-living multi-cluster vendors, got ${multi}`);
});

test('TentedCityMap paints each cluster rect, not the union, with a tight halo', () => {
  const map = fs.readFileSync(mapPath, 'utf8');
  const matchSrc = fs.readFileSync(matchPath, 'utf8');
  assert.match(matchSrc, /clusterLotRects/);
  assert.match(matchSrc, /rects: Rect\[\]/);
  assert.match(map, /vendorFootprint\.rects\.map/);
  assert.doesNotMatch(map, /vendorFootprint\.rect\.x/);
  assert.doesNotMatch(map, /marginLeft: -5/);
  assert.doesNotMatch(map, /borderWidth: 5, borderColor: 'rgba\(245,197,24/);
  assert.match(map, /borderWidth: 1, borderColor: 'rgba\(245,197,24/);
  assert.match(map, /flyToRect/);
  assert.match(map, /SELECTED_RESERVED_BOTTOM/);
});

test('Hanover / RAM / Wroxeter / Bell leftovers stay unmatched or 5A-missing', () => {
  const matchSrc = fs.readFileSync(matchPath, 'utf8');
  assert.match(matchSrc, /5A-01-04-do-not-exist/);
  assert.match(matchSrc, /3B-07-12-bruce-power-named-tent/);
  assert.ok(report.classes.ambiguous.includes('Hanover'));
  assert.ok(report.classes.ambiguous.includes('Dodge RAM'));
  assert.ok(report.classes.unmatched.includes('Wroxeter'));
  assert.ok(report.classes.unmatched.includes('Bell Mobility (Cell Tower)'));
  const hanover = allVendors.find((v) => v.name === 'Hanover' && v.locationLabel === '5A-01-04');
  assert.ok(hanover);
  assert.equal(hanover.booths.every((id) => !lots[id]), true);
});
