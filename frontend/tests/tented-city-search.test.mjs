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

export function norm(s) {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();
}

export function tokensMatch(hay, needle) {
  const h = ` ${norm(hay)} `;
  const n = norm(needle);
  if (!n) return false;
  if (n.length <= 3) {
    return h.includes(` ${n} `) || h.includes(` ${n}-`) || h.includes(`-${n} `) || h.endsWith(` ${n} `);
  }
  return norm(hay).includes(n);
}

function vendorTokensMatch(vendor, q) {
  return (
    tokensMatch(vendor.name, q) ||
    tokensMatch(vendor.locationLabel, q) ||
    vendor.booths.some((b) => tokensMatch(b, q))
  );
}

function normalizeVendorKey(s) {
  return (s || '')
    .replace(/[’‘‛ʻʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const LEGAL_SUFFIX = /\b(inc|ltd|llc|corp|limited|incorporated|corporation|company)\b/i;

function exhibitorBusinessName(name) {
  let current = name.trim();
  for (let i = 0; i < 2; i += 1) {
    const idx = current.lastIndexOf(',');
    if (idx < 0) break;
    const left = current.slice(0, idx).trimEnd();
    const right = current.slice(idx + 1).trim();
    if (!right || LEGAL_SUFFIX.test(right)) break;
    const words = right.replace(/\./g, '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) break;
    if (!/^[A-Za-z .'\-/]+$/.test(right)) break;
    current = left;
  }
  return current;
}

function isTrailingCityRemainder(exhibitorNorm, liveNorm) {
  if (!exhibitorNorm.startsWith(liveNorm)) return false;
  const rem = exhibitorNorm.slice(liveNorm.length);
  if (!rem) return true;
  return /^[\s.]*?,.+/.test(rem);
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
  const aliasName = VENDOR_MAP_ALIASES[key] || VENDOR_MAP_ALIASES[raw];
  if (aliasName) {
    const hit = vendors.find((vendor) => vendor.name === aliasName);
    return hit ? { status: 'mapped', query: hit.name } : { status: 'unmapped' };
  }
  const exact = uniqueByName(vendors.filter((vendor) => normalizeVendorKey(vendor.name) === key));
  if (exact.length === 1) return { status: 'mapped', query: exact[0].name };
  if (exact.length > 1) return { status: 'unmapped' };
  const cityStripped = uniqueByName(
    vendors.filter((vendor) => normalizeVendorKey(exhibitorBusinessName(vendor.name)) === key),
  );
  const prefixHits = uniqueByName(
    vendors.filter((vendor) => {
      const en = normalizeVendorKey(vendor.name);
      return en !== key && isTrailingCityRemainder(en, key);
    }),
  );
  const combined = uniqueByName([...cityStripped, ...prefixHits]);
  if (combined.length === 1) return { status: 'mapped', query: combined[0].name };
  return { status: 'unmapped' };
}

function searchTentedCity(query, vendors, filter = 'all', limit = 40) {
  const q = query.trim();
  if (!q) return [];
  const hits = [];
  if (filter !== 'stages') {
    const resolved = resolveVendorMapQuery(q, vendors);
    const mappedName = resolved.status === 'mapped' ? resolved.query : null;
    for (const vendor of vendors) {
      if (filter === 'food' && vendor.category !== 'food') continue;
      if (filter === 'vendors' && vendor.category === 'food') continue;
      if (vendorTokensMatch(vendor, q) || (mappedName !== null && vendor.name === mappedName)) {
        hits.push({ kind: 'vendor', vendor });
      }
    }
  }
  return hits.slice(0, limit);
}

function findTentedCityPlace(query, vendors) {
  if (!query || !query.trim()) return undefined;
  const q = query.trim();
  const exact = vendors.find(
    (v) => norm(v.name) === norm(q) || norm(v.locationLabel) === norm(q) || v.booths.some((b) => norm(b) === norm(q)),
  );
  if (exact) return { kind: 'vendor', vendor: exact };
  const resolved = resolveVendorMapQuery(q, vendors);
  if (resolved.status === 'mapped') {
    const mapped = vendors.find((v) => v.name === resolved.query);
    if (mapped) return { kind: 'vendor', vendor: mapped };
  }
  const fuzzy = vendors.find((v) => vendorTokensMatch(v, q));
  return fuzzy ? { kind: 'vendor', vendor: fuzzy } : undefined;
}

const vendors = loadExhibitors();
assert.equal(vendors.length, 318);

test('short queries use word boundaries so ACE does not match Wallaceburg', () => {
  assert.equal(tokensMatch('ACE / JCB, Harriston', 'ACE'), true);
  assert.equal(tokensMatch('Lambton Conveyor Ltd., Wallaceburg', 'ACE'), false);
});

test('booth numbers match', () => {
  assert.equal(tokensMatch('1A-09', '1A-09'), true);
  assert.equal(tokensMatch('1A-09', '1a-09'), true);
});

test('vendor names match beyond three letters', () => {
  assert.equal(tokensMatch('GGS Structures Inc., Vineland Station', 'GGS Structures'), true);
});

test('ACE / JCB still resolves to 1A-09', () => {
  const hits = searchTentedCity('ACE', vendors, 'vendors');
  const ace = hits.find((h) => h.vendor.name === 'ACE / JCB, Harriston');
  assert.ok(ace);
  assert.equal(ace.vendor.locationLabel, '1A-09');
  assert.equal(hits.some((h) => h.vendor.name.includes('Wallaceburg')), false);
  const place = findTentedCityPlace('ACE', vendors);
  assert.equal(place.vendor.name, 'ACE / JCB, Harriston');
  assert.equal(place.vendor.locationLabel, '1A-09');
});

test('live-list alias finds the bundled exhibitor', () => {
  const hits = searchTentedCity('Georgian Bay Funeral Services Association (GBFSA)', vendors);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].vendor.name, '(GBFSA), Hanover');
  const place = findTentedCityPlace('Georgian Bay Funeral Services Association (GBFSA)', vendors);
  assert.equal(place.vendor.name, '(GBFSA), Hanover');
});

test('city-stripped live name finds the exhibitor', () => {
  const hits = searchTentedCity('Accurate Canada', vendors, 'vendors');
  const match = hits.find((h) => h.vendor.name === 'Accurate Canada, Burlington');
  assert.ok(match);
  const place = findTentedCityPlace('Accurate Canada', vendors);
  assert.equal(place.vendor.name, 'Accurate Canada, Burlington');
});

test('Gay Lea live-list name finds the exhibitor once', () => {
  const hits = searchTentedCity('Gay Lea Foods Co-operative Ltd.', vendors);
  const gayLea = hits.filter((h) => h.kind === 'vendor' && h.vendor.name === 'Gay Lea Foods Co-operative Ltd');
  assert.equal(gayLea.length, 1);
  const place = findTentedCityPlace('Gay Lea Foods Co-operative Ltd.', vendors);
  assert.equal(place.vendor.name, 'Gay Lea Foods Co-operative Ltd');
});

test('default search limit can return more than 8 hits', () => {
  const unlimited = searchTentedCity('Ontario', vendors);
  assert.ok(unlimited.length > 8, `expected >8 Ontario hits, got ${unlimited.length}`);
  const capped = searchTentedCity('Ontario', vendors, 'all', 8);
  assert.equal(capped.length, 8);
  const defaulted = searchTentedCity('Ontario', vendors, 'all');
  assert.ok(defaulted.length > 8);
  assert.ok(defaulted.length <= 40);
});

test('wrap-split live names stay unmapped unless uniquely proven', () => {
  assert.equal(resolveVendorMapQuery('Bernie McGlynn Lumber / South Bruce Flooring', vendors).status, 'unmapped');
  assert.equal(resolveVendorMapQuery('Bruce Grey Catholic District School Board', vendors).status, 'unmapped');
  assert.equal(resolveVendorMapQuery('Ontario Youth Apprenticeship Program (OYAP)', vendors).status, 'unmapped');
});

test('source files restore Find on Map, live-name search, and scrollable results', () => {
  const vendorsTsx = fs.readFileSync(firstExisting([
    path.join(root, 'app/(tabs)/vendors.tsx'),
    path.join(root, 'vendors.tsx'),
  ]), 'utf8');
  assert.match(vendorsTsx, /useRouter/);
  assert.match(vendorsTsx, /resolveVendorMapQuery/);
  assert.match(vendorsTsx, /Find on Map/);
  assert.match(vendorsTsx, /mapLink/);
  assert.match(vendorsTsx, /mapStatus: 'unavailable'/);
  assert.doesNotMatch(vendorsTsx, /addConnectivityRefreshListener/);
  assert.doesNotMatch(vendorsTsx, /informationType/);

  const searchSrc = fs.readFileSync(firstExisting([
    path.join(root, 'src/config/tentedCitySearch.ts'),
    path.join(root, 'config/tentedCitySearch.ts'),
  ]), 'utf8');
  assert.match(searchSrc, /resolveVendorMapQuery/);
  assert.match(searchSrc, /limit = 40/);

  const mapSrc = fs.readFileSync(firstExisting([
    path.join(root, 'src/components/TentedCityMap.tsx'),
    path.join(root, 'components/TentedCityMap.tsx'),
  ]), 'utf8');
  assert.match(mapSrc, /ScrollView/);
  assert.match(mapSrc, /searchTentedCity\(query, tentedCityVendors, filter\)/);
  assert.match(mapSrc, /maxHeight: 260/);
  assert.doesNotMatch(mapSrc, /searchTentedCity\(query, tentedCityVendors, filter, 8\)/);
});

test('Armtec live name maps to Farming for the Future tent 1B-16-22', () => {
  const resolved = resolveVendorMapQuery('Armtec', vendors);
  assert.equal(resolved.status, 'mapped');
  assert.equal(resolved.query, 'Armtec, Cambridge');
  const place = findTentedCityPlace('Armtec', vendors);
  assert.equal(place.vendor.name, 'Armtec, Cambridge');
  assert.equal(place.vendor.locationLabel, '1B-16-22');
  const hits = searchTentedCity('Armtec', vendors, 'vendors');
  assert.ok(hits.some((h) => h.vendor.name === 'Armtec, Cambridge'));
});
