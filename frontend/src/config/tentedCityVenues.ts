// Staging-only Tented City venues. Names must match live schedule location_name values.
import type { Rect, TentedCityVenue } from './tentedCityTypes';
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
    ],
    kind: 'stage',
    rect: { x: 53.243, y: 41.875, w: 5.344, h: 3.854 },
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
    rect: { x: 7.8, y: 39.0, w: 11.8, h: 9.2 },
  },
  {
    id: 'quality-homes-stage',
    label: 'Quality Homes Stage',
    names: ['Quality Homes - Stage', 'Quality Homes'],
    kind: 'stage',
    rect: { x: 30.146, y: 37.495, w: 4.973, h: 3.854 },
  },
  {
    id: 'mnp-lifestyles',
    label: 'MNP Lifestyles Tent',
    names: ['MNP Lifestyles Tent', 'MNP Lifestyle Tent', 'The MNP Lifestyles Tent'],
    kind: 'landmark',
    rect: { x: 65.2, y: 28.8, w: 12.0, h: 7.2 },
  },
  {
    id: 'beyond-wireless-stage',
    label: 'The Beyond Wireless Stage',
    names: ['The Beyond Wireless Stage', 'Beyond Wireless Stage', 'Beyond Wireless'],
    kind: 'stage',
    rect: null,
    note: 'On the live schedule; booth location not printed in the Aug 15 exhibitor map yet.',
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
    note: 'On the live schedule; booth location not printed in the Aug 15 exhibitor map yet.',
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
