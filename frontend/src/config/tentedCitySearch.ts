import type { TentedCityPlace, TentedCityVendor } from './tentedCityTypes';
import { findTentedCityVenue, tentedCityVenues } from './tentedCityVenues';

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

export function searchTentedCity(
  query: string,
  vendors: TentedCityVendor[],
  filter: 'all' | 'food' | 'stages' | 'vendors' = 'all',
  limit = 8,
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
    for (const vendor of vendors) {
      if (filter === 'food' && vendor.category !== 'food') continue;
      if (filter === 'vendors' && vendor.category === 'food') continue;
      if (
        tokensMatch(vendor.name, q) ||
        tokensMatch(vendor.locationLabel, q) ||
        vendor.booths.some((b) => tokensMatch(b, q))
      ) {
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
  return vendors.find(
    (v) => tokensMatch(v.name, q) || tokensMatch(v.locationLabel, q) || v.booths.some((b) => tokensMatch(b, q)),
  )
    ? { kind: 'vendor', vendor: vendors.find((v) => tokensMatch(v.name, q) || tokensMatch(v.locationLabel, q) || v.booths.some((b) => tokensMatch(b, q)))! }
    : undefined;
}

export function placeRect(place: TentedCityPlace) {
  return place.kind === 'vendor' ? place.vendor.rect : place.venue.rect;
}

export function placeTitle(place: TentedCityPlace) {
  return place.kind === 'vendor' ? place.vendor.name : place.venue.label;
}
