#!/usr/bin/env node
/**
 * Build staging-only attendee VendorsResponse JSON from Sept8 unique exhibitors
 * + production NOT_ON_SEPT8 preservations. Deterministic; bake output into
 * frontend/public/api/vendors.json for Netlify static serving.
 *
 * Staging only — does not mutate production / Supabase / WonderPush.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '..');
const repoRoot = resolve(frontendRoot, '..');
const dataDir = join(__dirname, 'data');

const UUID_URL_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

const MUST_HAVES = [
  { re: /can-?am/i, location: 'WEST-02', label: 'CAN-AM' },
  { re: /valard/i, location: 'EAST-06', label: 'Valard' },
  { re: /bambrook/i, location: '1A-05', label: 'Bambrook' },
  { re: /cottrill/i, location: '2A-05', label: 'Cottrill' },
  { re: /transit\s+trailer/i, location: '2A-03-04', label: 'Transit Trailer' },
  { re: /ontario\s+government/i, location: '3B-19-24', label: 'Ontario Government' },
  { re: /university\s+of\s+guelph/i, location: '3B-16-17', label: 'UGuelph' },
  { re: /scatterbrain/i, location: '4A-13', label: 'Scatterbrain' },
  { re: /dj'?s\s+handcrafted/i, location: '4A-29-30', label: "DJ's" },
  { re: /fellowship\s+of\s+christian\s+farmers/i, location: '2A-17-18', label: 'Fellowship' },
  { re: /georgian\s+bay\s+funeral/i, location: '4B-05', label: 'Georgian Bay Funeral' },
  { re: /millroad/i, location: '1B-23-24', label: 'Millroad' },
  { re: /teeswater\s+agro/i, location: '1A-21', label: 'Teeswater Agro' },
  { re: /maitland\s+valley/i, location: '5B-10-12', label: 'Maitland' },
  { re: /dedell/i, location: '2B-19-20', label: 'DeDell' },
];

const DISPLAY_NAME_OVERRIDES = {
  'can-am': 'Can-Am Demo Area, Montreal, QC',
  'valard construction lp': 'Valard Construction, Vaughan',
  'valard construction': 'Valard Construction, Vaughan',
  'scatterbrain creations by paige': 'Scatterbrain Creations by Paige & Mom',
  'georgian bay funeral services': 'Georgian Bay Funeral Services Association (GBFSA)',
  'fellowship of christian farmers': 'Fellowship of Christian Farmers',
  'dedell seeds inc': 'DeDell Seeds Inc., Melbourne',
  'university of guelph': 'University of Guelph, Guelph',
  'cottrill heavy equipment': 'Cottrill Heavy Equipment, Kincardine',
  'millroad manufacturing & sales': 'Millroad Manufacturing & Sales',
};

function uuid5(name, namespace = UUID_URL_NAMESPACE) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(Buffer.concat([ns, Buffer.from(name, 'utf8')])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const LEGAL = /\b(inc|ltd|llc|corp|limited|incorporated|corporation|company|lp|co)\b\.?/gi;

function normalizeKey(s) {
  return String(s || '')
    .replace(/[’‘‛ʻʼ]/g, "'")
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(LEGAL, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCity(name) {
  let current = String(name || '').trim();
  for (let i = 0; i < 2; i += 1) {
    const idx = current.lastIndexOf(',');
    if (idx < 0) break;
    const left = current.slice(0, idx).trimEnd();
    const right = current.slice(idx + 1).trim();
    if (!right || LEGAL.test(right)) {
      LEGAL.lastIndex = 0;
      break;
    }
    LEGAL.lastIndex = 0;
    const words = right.replace(/\./g, '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) break;
    if (!/^[A-Za-z .'\-/]+$/.test(right)) break;
    current = left;
  }
  return current;
}

function mapAttendeeType(raw) {
  const parts = Array.isArray(raw) ? raw : [raw];
  const joined = parts.map((p) => String(p || '')).join(' ').toLowerCase();
  if (joined.includes('food')) return 'Food';
  if (joined.includes('indoor')) return 'Indoor';
  if (joined.includes('outdoor') || joined.includes('cxd') || joined.includes('general')) return 'Outdoor';
  return 'Outdoor';
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadMapVendors() {
  const dir = join(frontendRoot, 'src/data');
  const rows = [];
  for (const file of ['tentedCityVendorsPart1.ts', 'tentedCityVendorsPart2.ts', 'tentedCityVendorsPart3.ts']) {
    const text = readFileSync(join(dir, file), 'utf8');
    const start = text.indexOf('= [') + 2;
    const end = text.lastIndexOf(']') + 1;
    rows.push(...JSON.parse(text.slice(start, end)));
  }
  return rows;
}

function findSept8GroupedPath() {
  const candidates = [
    join(dataDir, 'sept8_exhibitors_grouped.json'),
    '/workspace/sept8-exhibitor-list/sept8_exhibitors_grouped.json',
    join(repoRoot, '../sept8-exhibitor-list/sept8_exhibitors_grouped.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error('sept8_exhibitors_grouped.json not found');
}

function findProdPath() {
  const candidates = [
    process.env.IPM_PROD_VENDORS_JSON,
    join(dataDir, 'production-vendors-snapshot.json'),
    '/tmp/prod-vendors.json',
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error('production vendors snapshot not found');
}

function indexByKeys(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    for (const key of keyFn(item)) {
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
  }
  return map;
}

function nameKeys(name) {
  const keys = new Set();
  const full = normalizeKey(name);
  const business = normalizeKey(stripCity(name));
  if (full) keys.add(full);
  if (business) keys.add(business);
  return [...keys];
}

function uniqueHit(list) {
  if (!list || list.length === 0) return null;
  const byId = new Map();
  for (const item of list) {
    const id = item.id || item.name;
    byId.set(id, item);
  }
  if (byId.size === 1) return [...byId.values()][0];
  return null;
}

function fuzzyLookup(index, name) {
  const keys = nameKeys(name);
  for (const key of keys) {
    const hit = uniqueHit(index.get(key));
    if (hit) return hit;
  }
  const primary = normalizeKey(stripCity(name));
  if (!primary || primary.length < 6) return null;
  const cands = [];
  for (const [key, items] of index.entries()) {
    if (!key || key.length < 6) continue;
    if (key === primary) {
      cands.push(...items);
      continue;
    }
    if (key.startsWith(primary) || primary.startsWith(key)) {
      if (Math.min(key.length, primary.length) >= 8) cands.push(...items);
    }
  }
  return uniqueHit(cands);
}

function preferMapDisplayName(sept8Name, mapVendor) {
  const override = DISPLAY_NAME_OVERRIDES[normalizeKey(sept8Name)];
  if (override) return override;
  if (mapVendor?.name) return mapVendor.name;
  // Prefer searchable tokens for CAN-AM raw name
  if (/^can-?am$/i.test(sept8Name.trim())) return 'Can-Am Demo Area, Montreal, QC';
  return sept8Name.trim();
}

function build() {
  const grouped = loadJson(findSept8GroupedPath());
  const prod = loadJson(findProdPath());
  const prodVendors = Array.isArray(prod.vendors) ? prod.vendors : prod;
  const mapVendors = loadMapVendors();

  const sept8 = (grouped.exhibitors || []).filter((e) => !e.is_parent_tent_placeholder);
  const mapByName = indexByKeys(mapVendors, (v) => nameKeys(v.name));
  const mapByLoc = indexByKeys(
    mapVendors.filter((v) => v.locationLabel),
    (v) => [normalizeKey(v.locationLabel)],
  );
  const prodByName = indexByKeys(prodVendors, (v) => nameKeys(v.name));
  const usedProdIds = new Set();

  const catalog = [];
  const report = {
    sept8_unique_including_parents: (grouped.exhibitors || []).length,
    sept8_unique_excluding_parents: sept8.length,
    parent_placeholders_skipped: (grouped.exhibitors || []).length - sept8.length,
    inserts: [],
    updates: [],
    preserves: [],
    must_haves: {},
  };

  for (const exhibitor of sept8) {
    const footprint = exhibitor.normalized_footprint || (exhibitor.locations || []).join(', ');
    let mapHit =
      fuzzyLookup(mapByName, exhibitor.name) ||
      uniqueHit(mapByLoc.get(normalizeKey(footprint)));

    // Prefer map row whose locationLabel matches footprint when multiple name hits
    if (!mapHit && footprint) {
      const locHits = mapVendors.filter(
        (v) => normalizeKey(v.locationLabel) === normalizeKey(footprint) &&
          nameKeys(v.name).some((k) => nameKeys(exhibitor.name).some((ek) => k === ek || k.startsWith(ek) || ek.startsWith(k))),
      );
      if (locHits.length === 1) mapHit = locHits[0];
    }

    const displayName = preferMapDisplayName(exhibitor.name, mapHit);
    const location = footprint || mapHit?.locationLabel || '';
    const type = mapAttendeeType(exhibitor.type);

    let prodHit =
      fuzzyLookup(prodByName, exhibitor.name) ||
      fuzzyLookup(prodByName, displayName) ||
      fuzzyLookup(prodByName, stripCity(displayName));

    // Prefer matching production type when duplicates exist (Dairy Farmers)
    if (prodHit) {
      const sameName = prodVendors.filter((v) => nameKeys(v.name).some((k) => nameKeys(prodHit.name).includes(k)));
      if (sameName.length > 1) {
        const typed = sameName.find((v) => v.type === type && !usedProdIds.has(v.id));
        prodHit = typed || sameName.find((v) => !usedProdIds.has(v.id)) || prodHit;
      }
      if (usedProdIds.has(prodHit.id)) {
        const alt = sameName.find((v) => !usedProdIds.has(v.id));
        prodHit = alt || null;
      }
    }

    const id = prodHit
      ? prodHit.id
      : uuid5(`ipm-vendor:${normalizeKey(displayName) || normalizeKey(exhibitor.name)}`);
    if (prodHit) usedProdIds.add(prodHit.id);

    const vendor = {
      id,
      name: displayName,
      type,
      location,
      hours_of_operation: prodHit?.hours_of_operation || '',
      days_of_operation: prodHit?.days_of_operation || '',
      priority: typeof prodHit?.priority === 'number' ? prodHit.priority : 99,
    };
    catalog.push(vendor);

    if (prodHit) {
      report.updates.push({ name: displayName, id, from: prodHit.name, location });
    } else {
      report.inserts.push({ name: displayName, id, location });
    }
  }

  // Preserve unmatched production vendors (NOT_ON_SEPT8)
  for (const pv of prodVendors) {
    if (usedProdIds.has(pv.id)) continue;
    const isAmSpec = /amspec/i.test(pv.name);
    const location = isAmSpec ? (pv.location?.trim() || '1B-16-22') : (pv.location || '');
    catalog.push({
      id: pv.id,
      name: pv.name,
      type: pv.type || 'Indoor',
      location,
      hours_of_operation: pv.hours_of_operation || '',
      days_of_operation: pv.days_of_operation || '',
      priority: typeof pv.priority === 'number' ? pv.priority : 99,
    });
    report.preserves.push({ name: pv.name, id: pv.id, type: pv.type, location, amspec_hold: isAmSpec });
  }

  // Stable sort by name then id
  catalog.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  // Must-have checks
  for (const mh of MUST_HAVES) {
    const hits = catalog.filter((v) => mh.re.test(v.name));
    report.must_haves[mh.label] = hits.map((v) => ({ name: v.name, location: v.location, id: v.id }));
    if (hits.length === 0) {
      console.warn(`WARNING: must-have missing: ${mh.label}`);
    } else if (!hits.some((v) => v.location === mh.location)) {
      console.warn(
        `WARNING: must-have ${mh.label} location mismatch: want ${mh.location}, got ${hits.map((v) => v.location).join('|')}`,
      );
    }
  }

  const response = {
    vendors: catalog,
    last_updated: new Date().toISOString(),
    total_count: catalog.length,
  };

  const outDir = join(frontendRoot, 'public/api');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'vendors.json');
  writeFileSync(outPath, `${JSON.stringify(response, null, 2)}\n`);

  report.expected_attendee_vendor_count = catalog.length;
  report.not_on_sept8_count = report.preserves.length;
  report.insert_count = report.inserts.length;
  report.update_count = report.updates.length;
  report.output = outPath;
  report.note =
    'Attendee Vendors tab uses unique exhibitors (sept8 non-parent) + preserved NOT_ON_SEPT8 production rows. Map geometry remains tentedCityVendorsPart*.ts.';

  const reportPath = join(repoRoot, 'STAGING_VENDORS_RECONCILE_REPORT.md');
  const md = `# STAGING VENDORS RECONCILE REPORT

**Date:** ${new Date().toISOString()} (UTC)  
**Scope:** STAGING-ONLY static \`/api/vendors\` catalog  
**Production / main / WonderPush / Supabase:** NOT touched

## Architecture

- **Before:** Netlify proxied \`/api/vendors\` → production Render Google Sheets list (127 UUID vendors, blank locations)
- **After:** Netlify serves baked \`frontend/public/api/vendors.json\` (status 200). Other \`/api/*\` unchanged.
- **Map geometry:** still \`tentedCityVendorsPart*.ts\` (326 booth rows)

## Counts

| Metric | Value |
|---|---|
| Sept8 unique (incl. parent placeholders) | ${report.sept8_unique_including_parents} |
| Sept8 unique exhibitors (excl. parents) | ${report.sept8_unique_excluding_parents} |
| Parent placeholders skipped | ${report.parent_placeholders_skipped} |
| Matched production UUIDs (updates) | ${report.update_count} |
| New uuid5 inserts | ${report.insert_count} |
| NOT_ON_SEPT8 preserved | ${report.not_on_sept8_count} |
| **Expected attendee vendor count** | **${report.expected_attendee_vendor_count}** |

Difference from Sept8's 166 unique: 166 includes ${report.parent_placeholders_skipped} parent tent placeholders (not Vendor cards). Catalog = ${report.sept8_unique_excluding_parents} Sept8 exhibitors + ${report.not_on_sept8_count} preserved production-only rows.

## Must-haves

${MUST_HAVES.map((mh) => {
  const hits = report.must_haves[mh.label] || [];
  const ok = hits.some((h) => h.location === mh.location);
  return `- **${mh.label}** → \`${mh.location}\`: ${ok ? 'OK' : 'CHECK'} ${hits.map((h) => `${h.name} @ ${h.location}`).join('; ') || 'MISSING'}`;
}).join('\n')}

## AmSpec HOLD

${(report.preserves.filter((p) => p.amspec_hold).map((p) => `- ${p.name} id=${p.id} location=\`${p.location}\``).join('\n')) || '- (not present in production snapshot)'}

## Output

- Script: \`frontend/scripts/build-staging-vendors-catalog.mjs\`
- JSON: \`frontend/public/api/vendors.json\`
- Snapshots: \`frontend/scripts/data/sept8_exhibitors_grouped.json\`, \`frontend/scripts/data/production-vendors-snapshot.json\`
`;

  writeFileSync(reportPath, md);
  writeFileSync(join(dataDir, 'staging-vendors-build-report.json'), `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify({
    total_count: response.total_count,
    inserts: report.insert_count,
    updates: report.update_count,
    preserves: report.not_on_sept8_count,
    output: outPath,
    report: reportPath,
  }, null, 2));
}

build();
