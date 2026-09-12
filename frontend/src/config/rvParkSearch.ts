import {
  getRvParkSite,
  RV_PARK_ALL_PLACES,
  RV_PARK_CAMPSITES,
  RV_PARK_LANDMARKS,
  RV_PARK_NON_SEARCHABLE,
  type RvParkSite,
} from './rvParkGeometry';

/** Normalize campsite queries: M27 / m27 / M 27 / m-27 → M27. */
export function normalizeRvSiteQuery(raw: string | null | undefined): string {
  if (!raw) return '';
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[_./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  const siteMatch = cleaned.match(/^([A-Z])\s*(\d{1,2})$/);
  if (siteMatch) return `${siteMatch[1]}${siteMatch[2]}`;

  return cleaned;
}

function aliasKey(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export type RvParkSearchResult =
  | { status: 'found'; site: RvParkSite; title: string }
  | { status: 'not_found'; query: string; title: 'Site not found' };

export function rvParkPlaceTitle(site: RvParkSite): string {
  if (site.KIND === 'office' || site.SITE_ID === 'RV_PARK_OFFICE') return 'RV Park Office';
  if (site.KIND === 'dump' || site.SITE_ID === 'RV_DUMP_STATION') return 'Dump Station';
  return `RV Site ${site.SITE_ID}`;
}

function matchLandmark(query: string): RvParkSite | undefined {
  const needle = aliasKey(query);
  if (!needle) return undefined;

  for (const landmark of RV_PARK_LANDMARKS) {
    const aliases = [landmark.SITE_ID.replace(/_/g, ' '), ...(landmark.search_aliases || [])];
    if (aliases.some((a) => aliasKey(a) === needle)) return landmark;
  }

  // Common short aliases
  if (needle === 'office' || needle === 'park office') {
    return RV_PARK_LANDMARKS.find((l) => l.KIND === 'office' || l.SITE_ID === 'RV_PARK_OFFICE');
  }
  if (needle === 'dump' || needle === 'dump station') {
    return RV_PARK_LANDMARKS.find((l) => l.KIND === 'dump' || l.SITE_ID === 'RV_DUMP_STATION');
  }

  for (const landmark of RV_PARK_LANDMARKS) {
    const aliases = landmark.search_aliases || [];
    if (aliases.some((a) => {
      const key = aliasKey(a);
      return key.includes(needle) || needle.includes(key);
    })) {
      return landmark;
    }
  }
  return undefined;
}

export function findRvParkPlace(query: string | null | undefined): RvParkSearchResult | null {
  if (!query || !query.trim()) return null;
  const raw = query.trim();
  const normalized = normalizeRvSiteQuery(raw);
  if (!normalized) return null;

  if (RV_PARK_NON_SEARCHABLE.some((label) => aliasKey(label) === aliasKey(raw))) {
    return { status: 'not_found', query: raw, title: 'Site not found' };
  }

  const byId = getRvParkSite(normalized);
  if (byId && (byId.KIND === 'campsite' || !byId.KIND)) {
    return { status: 'found', site: byId, title: rvParkPlaceTitle(byId) };
  }

  const landmark = matchLandmark(raw);
  if (landmark) {
    return { status: 'found', site: landmark, title: rvParkPlaceTitle(landmark) };
  }

  // Invented / missing IDs (C16, Q5, etc.) and other unknowns
  return { status: 'not_found', query: normalized || raw, title: 'Site not found' };
}

export function searchRvParkPlaces(query: string, limit = 20): RvParkSite[] {
  const q = query.trim();
  if (!q) return [];
  const normalized = normalizeRvSiteQuery(q);
  const hits: RvParkSite[] = [];

  const exact = findRvParkPlace(q);
  if (exact?.status === 'found') hits.push(exact.site);

  if (/^[A-Z]\d{0,2}$/.test(normalized)) {
    for (const site of RV_PARK_CAMPSITES) {
      if (hits.some((h) => h.SITE_ID === site.SITE_ID)) continue;
      if (site.SITE_ID.startsWith(normalized)) hits.push(site);
      if (hits.length >= limit) break;
    }
  }

  const needle = aliasKey(q);
  if (needle.length >= 3) {
    for (const landmark of RV_PARK_LANDMARKS) {
      if (hits.some((h) => h.SITE_ID === landmark.SITE_ID)) continue;
      const aliases = landmark.search_aliases || [];
      if (aliases.some((a) => aliasKey(a).includes(needle) || needle.includes(aliasKey(a)))) {
        hits.push(landmark);
      }
    }
  }

  return hits.slice(0, limit);
}

/** Guard: campsites must never be registered in global/unified Grounds search. */
export function rvParkCampsitesExcludedFromGlobalSearch(): boolean {
  return RV_PARK_ALL_PLACES.length > 0 && RV_PARK_CAMPSITES.length === 690;
}
