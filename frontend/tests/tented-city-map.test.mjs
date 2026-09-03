import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function loadExhibitors() {
  const dir = path.join(root, 'data');
  const rows = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.startsWith('tentedCityVendorsPart') && f.endsWith('.ts')).sort()) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const start = text.indexOf('= [') + 2;
    const end = text.lastIndexOf(']') + 1;
    rows.push(...JSON.parse(text.slice(start, end)));
  }
  return rows;
}

const IMAGE_ASPECT = 1935 / 1508;

function tentedCityFittedSize(vw, vh) {
  const width = Math.max(vw, 1);
  const height = Math.max(vh, 1);
  const viewAspect = width / height;
  if (viewAspect > IMAGE_ASPECT) {
    return { width: height * IMAGE_ASPECT, height };
  }
  return { width, height: width / IMAGE_ASPECT };
}

function tentedCityPaintViewport(measured, windowSize) {
  if (measured && measured.width > 1 && measured.height > 1) return measured;
  return {
    width: Math.max(windowSize.width, 1),
    height: Math.max(windowSize.height, 1),
  };
}

function tentedCityLayerLayout(viewport) {
  const mapSize = tentedCityFittedSize(viewport.width, viewport.height);
  return {
    mapSize,
    width: mapSize.width,
    height: mapSize.height,
    left: (viewport.width - mapSize.width) / 2,
    top: (viewport.height - mapSize.height) / 2,
    renderable: mapSize.width > 0 && mapSize.height > 0,
  };
}

function normalizeVendorKey(s) {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9&]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function stripLegalSuffix(s) {
  return normalizeVendorKey(s.replace(/\b(incorporated|corporation|limited|company|inc|ltd|llc|corp)\b\.?/gi, ' '));
}
function exhibitorBusinessName(name) {
  if (!name.includes(',')) return name.trim();
  const idx = name.lastIndexOf(',');
  const left = name.slice(0, idx).trim();
  const right = name.slice(idx + 1).trim();
  if (right && !/\b(inc|ltd|llc|corp)\b/i.test(right) && right.split(/\s+/).length <= 4) return left;
  return name.trim();
}

const VENDOR_MAP_ALIASES = {
  [normalizeVendorKey('Gay Lea Foods Co-operative Ltd.')]: 'Gay Lea Foods Co-operative Ltd',
  [normalizeVendorKey('Georgian Bay Funeral Services Association (GBFSA)')]: '(GBFSA), Hanover',
  [normalizeVendorKey('Kincardine & Community Health Care Foundation')]: 'Kincardine & Community Health Care',
};

function uniqueByName(rows) {
  const map = new Map();
  for (const row of rows) map.set(row.name, row);
  return [...map.values()];
}

function resolveVendorMapQuery(liveName, vendors) {
  const raw = (liveName || '').trim();
  if (!raw) return { status: 'unmapped' };
  const key = normalizeVendorKey(raw);
  if (!key) return { status: 'unmapped' };
  const aliasName = VENDOR_MAP_ALIASES[key];
  if (aliasName) {
    const hit = vendors.find((v) => v.name === aliasName);
    return hit ? { status: 'mapped', query: hit.name, exhibitorName: hit.name } : { status: 'unmapped' };
  }
  const exact = uniqueByName(vendors.filter((v) => normalizeVendorKey(v.name) === key));
  if (exact.length === 1) return { status: 'mapped', query: exact[0].name, exhibitorName: exact[0].name };
  const city = uniqueByName(vendors.filter((v) => normalizeVendorKey(exhibitorBusinessName(v.name)) === key));
  if (city.length === 1) return { status: 'mapped', query: city[0].name, exhibitorName: city[0].name };
  const legalKey = stripLegalSuffix(raw);
  if (legalKey) {
    const legal = uniqueByName(vendors.filter((v) => stripLegalSuffix(exhibitorBusinessName(v.name)) === legalKey));
    if (legal.length === 1) return { status: 'mapped', query: legal[0].name, exhibitorName: legal[0].name };
  }
  return { status: 'unmapped' };
}

function tokensMatch(hay, needle) {
  const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();
  const h = ` ${norm(hay)} `;
  const n = norm(needle);
  if (!n) return false;
  if (n.length <= 3) {
    return h.includes(` ${n} `) || h.includes(` ${n}-`) || h.includes(`-${n} `) || h.endsWith(` ${n} `);
  }
  return norm(hay).includes(n);
}

const vendors = loadExhibitors();
assert.equal(vendors.length, 285);

test('Tented City has valid initial dimensions without onLayout', () => {
  const viewport = tentedCityPaintViewport(null, { width: 390, height: 844 });
  const layer = tentedCityLayerLayout(viewport);
  assert.equal(viewport.width, 390);
  assert.ok(layer.renderable);
  assert.ok(layer.width > 100);
  assert.ok(layer.height > 100);
});

test('first open does not depend on user interaction to paint', () => {
  const before = tentedCityLayerLayout(tentedCityPaintViewport(null, { width: 360, height: 780 }));
  const afterScroll = tentedCityLayerLayout(tentedCityPaintViewport({ width: 360, height: 700 }, { width: 360, height: 780 }));
  assert.equal(before.renderable, true);
  assert.equal(afterScroll.renderable, true);
  assert.ok(before.width > 0 && before.height > 0);
});

test('zero window still paints a positive layer', () => {
  const layer = tentedCityLayerLayout(tentedCityPaintViewport(null, { width: 0, height: 0 }));
  assert.equal(layer.renderable, true);
  assert.ok(layer.width > 0);
  assert.ok(layer.height > 0);
});

test('exact Vendor name resolves correctly', () => {
  const resolved = resolveVendorMapQuery('Accurate Canada', vendors);
  assert.equal(resolved.status, 'mapped');
  assert.equal(resolved.query, 'Accurate Canada, Burlington');
  const exhibitor = vendors.find((v) => v.name === resolved.query);
  assert.equal(exhibitor.locationLabel, '5A-12');
  assert.ok(exhibitor.rect);
});

test('confirmed alias resolves correctly', () => {
  const resolved = resolveVendorMapQuery('Georgian Bay Funeral Services Association (GBFSA)', vendors);
  assert.equal(resolved.status, 'mapped');
  assert.equal(resolved.query, '(GBFSA), Hanover');
  assert.equal(vendors.find((v) => v.name === resolved.query).locationLabel, '4B-05');
});

test('unknown Vendor does not guess', () => {
  assert.equal(resolveVendorMapQuery('Kubota', vendors).status, 'unmapped');
  assert.equal(resolveVendorMapQuery('Walkerton Clean Water Centre', vendors).status, 'unmapped');
  assert.equal(resolveVendorMapQuery('iLGi Canada', vendors).status, 'unmapped');
  assert.equal(resolveVendorMapQuery('Agriculture and Agri-Food Canada', vendors).status, 'unmapped');
  assert.equal(resolveVendorMapQuery('Bernie McGlynn Lumber / South Bruce Flooring', vendors).status, 'unmapped');
  assert.equal(resolveVendorMapQuery('Bruce Grey Catholic District School Board', vendors).status, 'unmapped');
  assert.equal(resolveVendorMapQuery('Ontario Youth Apprenticeship Program (OYAP)', vendors).status, 'unmapped');
});

test('ACE resolves to ACE / JCB at 1A-09', () => {
  const ace = vendors.find((v) => tokensMatch(v.name, 'ACE') && v.locationLabel === '1A-09');
  assert.ok(ace);
  assert.equal(ace.name, 'ACE / JCB, Harriston');
  assert.ok(ace.rect);
});

test('ACE does not match Wallaceburg', () => {
  assert.equal(tokensMatch('ACE / JCB, Harriston', 'ACE'), true);
  assert.equal(tokensMatch('Lambton Conveyor Ltd., Wallaceburg', 'ACE'), false);
});

test('Find on Map uses the canonical mapped exhibitor after alias resolution', () => {
  const resolved = resolveVendorMapQuery('Georgian Bay Funeral Services Association (GBFSA)', vendors);
  assert.equal(resolved.status, 'mapped');
  assert.equal(resolved.query, '(GBFSA), Hanover');
  const exhibitor = vendors.find((v) => v.name === resolved.query);
  assert.ok(exhibitor.rect);
  assert.equal(exhibitor.locationLabel, '4B-05');
  const gayLea = resolveVendorMapQuery('Gay Lea Foods Co-operative Ltd.', vendors);
  assert.equal(gayLea.status, 'mapped');
  assert.equal(gayLea.query, 'Gay Lea Foods Co-operative Ltd');
});

test('booth pin/selection data remains intact for mapped exhibitors', () => {
  for (const live of ['Accurate Canada', 'Lambton Conveyor Ltd', 'Hallman Motors Ltd']) {
    const resolved = resolveVendorMapQuery(live, vendors);
    assert.equal(resolved.status, 'mapped', live);
    const exhibitor = vendors.find((v) => v.name === resolved.query);
    assert.ok(exhibitor.rect && exhibitor.rect.w > 0 && exhibitor.rect.h > 0, live);
  }
});

test('Grounds map screen still imports MapComponent', () => {
  const mapTsx = fs.readFileSync(path.join(root, 'map.tsx'), 'utf8');
  assert.match(mapTsx, /import MapComponent from/);
  assert.match(mapTsx, /highlightedLocation=/);
  assert.match(mapTsx, /mode === 'tented'/);
});
