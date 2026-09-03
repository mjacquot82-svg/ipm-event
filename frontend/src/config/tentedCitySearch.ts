import type { TentedCityPlace, TentedCityVendor } from './tentedCityTypes';
import { findTentedCityVenue, tentedCityVenues } from './tentedCityVenues';
import { resolveVendorMapQuery } from './vendorMapCrosswalk';

export function norm(s: string) {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();
}

export function tokensMatch(hay: string, needle: string) {
  const h = ` ${norm(hay)} `;
  const n = norm(needle);
  if (!n) return false;
  if (n.length <= 3) {
    return h.includes(` ${n} `) || h.includes(` ${n}-`) || h.includes(`-${n} `) || h.endsWith(` ${n} `);
  }
  return norm(hay).includes(n);
}

function vendorTokensMatch(vendor: TentedCityVendor, q: string) {
  return (
    tokensMatch(vendor.name, q) ||
    tokensMatch(vendor.locationLabel, q) ||
    vendor.booths.some((b) => tokensMatch(b, q))
  );
}

export function searchTentedCity(
  query: string,
  vendors: TentedCityVendor[],
  filter: 'all' | 'food' | 'stages' | 'vendors' = 'all',
  limit = 40,
): TentedCityPlace[] {
  const q = query.trim();
  if (!q) return [];
  const hits: TentedCityPlace[] = [];

  if (filter === 'all' || filter === 'stages') {
    for (const venue of tentedCityVenues) {
      if (tokensMatch(venue.label, q) || venue.names.some((n) => tokensMatch(n, q))) {
        hits.push({ kind: 'stage', venue });
      }
    }
  }

  if (filter !== 'stages') {
    const resolved = resolveVendorMapQuery(q);
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

export function findTentedCityPlace(
  query: string | null | undefined,
  vendors: TentedCityVendor[],
): TentedCityPlace | undefined {
  if (!query || !query.trim()) return undefined;
  const venue = findTentedCityVenue(query);
  if (venue) return { kind: 'stage', venue };
  const q = query.trim();
  const exact = vendors.find(
    (v) => norm(v.name) === norm(q) || norm(v.locationLabel) === norm(q) || v.booths.some((b) => norm(b) === norm(q)),
  );
  if (exact) return { kind: 'vendor', vendor: exact };
  const resolved = resolveVendorMapQuery(q);
  if (resolved.status === 'mapped') {
    const mapped = vendors.find((v) => v.name === resolved.query);
    if (mapped) return { kind: 'vendor', vendor: mapped };
  }
  const fuzzy = vendors.find((v) => vendorTokensMatch(v, q));
  return fuzzy ? { kind: 'vendor', vendor: fuzzy } : undefined;
}

export function placeRect(place: TentedCityPlace) {
  return place.kind === 'vendor' ? place.vendor.rect : place.venue.rect;
}

export function placeTitle(place: TentedCityPlace) {
  return place.kind === 'vendor' ? place.vendor.name : place.venue.label;
}
