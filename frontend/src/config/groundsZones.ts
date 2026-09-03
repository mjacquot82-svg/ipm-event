export type GroundsRect = { x: number; y: number; w: number; h: number };

export type GroundsZoneId =
  | 'tented-city'
  | 'tractor-plowing'
  | 'horse-plowing'
  | 'west-parking'
  | 'north-parking'
  | 'rv-park'
  | 'bus-stop';

export type GroundsZone = {
  id: GroundsZoneId;
  label: string;
  rect: GroundsRect;
  fact: string;
  action: 'switch-tented' | 'info';
  color: string;
};

/** Footer-cropped official IPM 2026 site map (header title kept). */
export const GROUNDS_MAP = {
  imageWidth: 1344,
  imageHeight: 2006,
  assetPath: '../../assets/images/grounds-site-map.jpg',
  coordinateSpace: 'percent' as const,
};

/**
 * Bounding boxes as percent of the cropped official artwork.
 * Measured from colour extraction on the footer-cropped canvas (645x963),
 * which matches 1344x2006.
 */
export const GROUNDS_ZONES: GroundsZone[] = [
  {
    id: 'bus-stop',
    label: 'Bus Stop',
    rect: { x: 33.333, y: 34.372, w: 3.721, h: 1.869 },
    fact: 'Shuttle stop on the site road north of Tented City.',
    action: 'info',
    color: '#7B4EA3',
  },
  {
    id: 'horse-plowing',
    label: 'Horse Plowing',
    rect: { x: 17.829, y: 42.471, w: 8.372, h: 5.504 },
    fact: 'Horse Plowing.',
    action: 'info',
    color: '#E6C229',
  },
  {
    id: 'tented-city',
    label: 'Tented City',
    rect: { x: 31.473, y: 37.072, w: 14.884, h: 10.592 },
    fact: 'Open the Tented City map for exhibitors, food, and stages.',
    action: 'switch-tented',
    color: '#E07A2F',
  },
  {
    id: 'north-parking',
    label: 'North Parking Lot',
    rect: { x: 18.14, y: 47.248, w: 14.419, h: 9.553 },
    fact: 'Parking is free.',
    action: 'info',
    color: '#3A7BC8',
  },
  {
    id: 'rv-park',
    label: 'RV Park',
    rect: { x: 35.969, y: 50.675, w: 13.488, h: 7.269 },
    fact: 'RV Park.',
    action: 'info',
    color: '#7B4EA3',
  },
  {
    id: 'west-parking',
    label: 'West Parking Lot',
    rect: { x: 35.659, y: 57.425, w: 29.302, h: 15.472 },
    fact: 'Parking is free.',
    action: 'info',
    color: '#3A7BC8',
  },
  {
    id: 'tractor-plowing',
    label: 'Tractor Plowing',
    rect: { x: 62.171, y: 35.41, w: 24.186, h: 24.091 },
    fact: 'Tractor Plowing.',
    action: 'info',
    color: '#E6C229',
  },
];

function zoneById(id: GroundsZoneId): GroundsZone {
  const zone = GROUNDS_ZONES.find((item) => item.id === id);
  if (!zone) throw new Error('missing grounds zone ' + id);
  return zone;
}

function normalizeZoneQuery(name: string) {
  return name.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Fail closed: only official names that clearly mean one site-map zone. */
const GROUNDS_ZONE_ALIASES: Record<string, GroundsZoneId> = {
  'tented city': 'tented-city',
  'rv park': 'rv-park',
  rv: 'rv-park',
  'horse plowing': 'horse-plowing',
  'tractor plowing': 'tractor-plowing',
  'west parking lot': 'west-parking',
  'west parking': 'west-parking',
  'north parking lot': 'north-parking',
  'north parking': 'north-parking',
  'bus stop': 'bus-stop',
};

export function resolveGroundsZone(name: string | null | undefined): GroundsZone | null {
  if (!name) return null;
  const key = normalizeZoneQuery(name);
  if (!key) return null;
  const id = GROUNDS_ZONE_ALIASES[key];
  return id ? zoneById(id) : null;
}

export function hitTestGroundsZone(x: number, y: number): GroundsZone | null {
  let best: GroundsZone | null = null;
  let bestArea = Infinity;
  for (const zone of GROUNDS_ZONES) {
    const r = zone.rect;
    if (x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) continue;
    const area = r.w * r.h;
    if (area < bestArea) {
      best = zone;
      bestArea = area;
    }
  }
  return best;
}
