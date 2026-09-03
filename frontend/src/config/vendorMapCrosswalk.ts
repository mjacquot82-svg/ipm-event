import { tentedCityVendors } from '../data/tentedCityVendors';
import type { TentedCityVendor } from './tentedCityTypes';

/**
 * Strict vendor-key normalization for exact matching:
 * trim, collapse whitespace, case-fold, unify curly/straight apostrophes.
 * Does not strip other punctuation or legal suffixes.
 */
export function normalizeVendorKey(s: string): string {
  return (s || '')
    .replace(/[’‘‛ʻʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const LEGAL_SUFFIX = /\b(inc|ltd|llc|corp|limited|incorporated|corporation|company)\b/i;

/** Drop a trailing printed city/province ("Name, Harriston" or "Name, Saskatoon, SK"). */
export function exhibitorBusinessName(name: string): string {
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

function isTrailingCityRemainder(exhibitorNorm: string, liveNorm: string): boolean {
  if (!exhibitorNorm.startsWith(liveNorm)) return false;
  const rem = exhibitorNorm.slice(liveNorm.length);
  if (!rem) return true;
  return /^[\s.]*?,.+/.test(rem);
}

/**
 * Confirmed aliases only. Keys are normalizeVendorKey(live spreadsheet name).
 * Values are the exact bundled exhibitor `name` string.
 *
 * Wrap-split printed lines (Bernie McGlynn, Bruce Grey CDSB, OYAP) are NOT
 * aliases: two exhibitor rows could fit, so they stay unmapped.
 */
export const VENDOR_MAP_ALIASES: Record<string, string> = {
  [normalizeVendorKey('Gay Lea Foods Co-operative Ltd.')]: 'Gay Lea Foods Co-operative Ltd',
  [normalizeVendorKey('Georgian Bay Funeral Services Association (GBFSA)')]:
    '(GBFSA), Hanover',
  [normalizeVendorKey('Kincardine & Community Health Care Foundation')]:
    'Kincardine & Community Health Care',
};

export type VendorMapResolution =
  | { status: 'mapped'; query: string }
  | { status: 'unmapped' };

function uniqueByName(rows: TentedCityVendor[]): TentedCityVendor[] {
  const map = new Map<string, TentedCityVendor>();
  for (const row of rows) map.set(row.name, row);
  return [...map.values()];
}

/**
 * Deterministic live-vendor → official exhibitor resolution.
 * Exact matches compare normalized live names to exhibitor names and unique
 * city-stripped / trailing-city prefixes. Aliases use VENDOR_MAP_ALIASES.
 * Never returns a guessed exhibitor.
 */
export function resolveVendorMapQuery(
  liveName: string,
  _liveLocation?: string | null,
): VendorMapResolution {
  const raw = (liveName || '').trim();
  if (!raw) return { status: 'unmapped' };
  const key = normalizeVendorKey(raw);
  if (!key) return { status: 'unmapped' };

  const aliasName = VENDOR_MAP_ALIASES[key] || VENDOR_MAP_ALIASES[raw];
  if (aliasName) {
    const hit = tentedCityVendors.find((vendor) => vendor.name === aliasName);
    return hit ? { status: 'mapped', query: hit.name } : { status: 'unmapped' };
  }

  const exact = uniqueByName(
    tentedCityVendors.filter((vendor) => normalizeVendorKey(vendor.name) === key),
  );
  if (exact.length === 1) return { status: 'mapped', query: exact[0].name };
  if (exact.length > 1) return { status: 'unmapped' };

  const cityStripped = uniqueByName(
    tentedCityVendors.filter(
      (vendor) => normalizeVendorKey(exhibitorBusinessName(vendor.name)) === key,
    ),
  );
  const prefixHits = uniqueByName(
    tentedCityVendors.filter((vendor) => {
      const en = normalizeVendorKey(vendor.name);
      return en !== key && isTrailingCityRemainder(en, key);
    }),
  );
  const combined = uniqueByName([...cityStripped, ...prefixHits]);
  if (combined.length === 1) return { status: 'mapped', query: combined[0].name };

  return { status: 'unmapped' };
}

export default {
  normalizeVendorKey,
  exhibitorBusinessName,
  VENDOR_MAP_ALIASES,
  resolveVendorMapQuery,
};
