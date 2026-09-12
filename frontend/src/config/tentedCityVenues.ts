// Staging-only Tented City venues. Names must match live schedule location_name values.
import type { Rect, TentedCityVenue } from './tentedCityTypes';
import { BRITESPAN_BUILDING_RECT, CKNX_WEST3_RECT, MNP_LIFESTYLES_EAST2_RECT } from './tentedCityGeometry';
export type { Rect, TentedCityVenue };

export const tentedCityVenues: TentedCityVenue[] = [
  {
    id: 'ontario-mutuals-main-stage',
    label: 'Ontario Mutuals Main Stage',
    names: [
      'Ontario Mutuals Main Stage - In the Britespan Building',
      'Ontario Mutuals Main Stage',
      'Ontario Mutuals Main Stage in the Britespan Building',
      'Britespan Building',
      'Britespan Main Stage Building',
      'Main Stage',
      'Welcome Centre',
      'Welcome Center',
    ],
    kind: 'stage',
    // Britespan campus on south TC artwork — not Hydro One Avenue / 3B-28-32.
    rect: BRITESPAN_BUILDING_RECT,
  },
  {
    id: 'cknx-gfo-lounge',
    label: 'CKNX Centennial Pavilion (GFO Stage)',
    names: [
      'CKNX Centennial Pavilion (GFO Stage) Lounge',
      'CKNX Centennial Pavilion',
      'CKNX Centennial Pavillion (GFO Stage)',
      'GFO Stage',
      'Grain Farmers of Ontario Stage',
      'CKNX Centennial Pavilion (Lounge)',
    ],
    kind: 'stage',
    rect: CKNX_WEST3_RECT,
  },
  {
    id: 'quality-homes-stage',
    label: 'Quality Homes Stage',
    names: ['Quality Homes - Stage', 'Quality Homes'],
    kind: 'stage',
    // No audited individual stage footprint. Do not invent one and never reuse
    // Quality Homes exhibitor booth 3A-09-12 as a stage location.
    rect: null,
    parentVenueId: 'mnp-lifestyles',
    note: 'Find-on-Map uses parent MNP Lifestyles Tent / EAST-2. Do not invent stage footprints; never use Quality Homes booth 3A-09-12.',
  },
  {
    id: 'mnp-lifestyles',
    label: 'MNP Lifestyles Tent',
    names: ['MNP Lifestyles Tent', 'MNP Lifestyle Tent', 'The MNP Lifestyles Tent'],
    kind: 'landmark',
    // Prefer trusted PDF geometry area named-mnp-lifestyles-tent-east-2 (not Mutual Square / not road-legend strip).
    rect: MNP_LIFESTYLES_EAST2_RECT,
  },
  {
    id: 'beyond-wireless-stage',
    label: 'The Beyond Wireless Stage',
    names: ['The Beyond Wireless Stage', 'Beyond Wireless Stage', 'Beyond Wireless'],
    kind: 'stage',
    rect: null,
    parentVenueId: 'mnp-lifestyles',
    note: 'Find-on-Map uses parent MNP Lifestyles Tent / EAST-2. Do not invent stage footprints.',
  },
  {
    id: 'harleys-stage',
    label: "Harley's Pub & Perk Stage",
    names: [
      "Harley's Pub & Perk - Stage",
      "Harley’s Pub & Perk - Stage",
      "Harley’s Pub and Perk",
      "Harley's Pub & Perk",
    ],
    kind: 'stage',
    rect: null,
    parentVenueId: 'mnp-lifestyles',
    note: 'Find-on-Map uses parent MNP Lifestyles Tent / EAST-2. Do not invent stage footprints.',
  },
];

function norm(s: string) {
  return s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
}

export function findTentedCityVenue(query?: string | null): TentedCityVenue | undefined {
  if (!query) return undefined;
  const q = norm(query);
  if (!q) return undefined;
  const exact = tentedCityVenues.find((v) => v.names.some((n) => norm(n) === q));
  if (exact) return exact;
  return tentedCityVenues.find(
    (v) => v.names.some((n) => norm(n).includes(q) || q.includes(norm(n))) || norm(v.label).includes(q)
  );
}

export default tentedCityVenues;
