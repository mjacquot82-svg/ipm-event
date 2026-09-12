export type GroundsRect = { x: number; y: number; w: number; h: number };
/** Percent coordinates on the displayed grounds artwork (0–100). */
export type GroundsPoint = [number, number];

export type GroundsZoneId =
  | 'tented-city'
  | 'tractor-plowing'
  | 'horse-plowing'
  | 'west-parking'
  | 'north-parking'
  | 'rv-park'
  | 'bus-stop'
  | 'accessible-parking';

export type GroundsZone = {
  id: GroundsZoneId;
  label: string;
  /** Axis-aligned bbox used for fly-to framing (and native highlight fallback). */
  rect: GroundsRect;
  /**
   * Footprint polygon in percent of the displayed app artwork (grounds-site-map.jpg).
   * Digitized from colour-mask contours on that image (not 911 north-up page %).
   */
  polygon: GroundsPoint[];
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
 * Zone footprints digitized on grounds-site-map.jpg (1344×2006) via colour extraction
 * + morph-close + convex-hull / span polygons. Identity cross-checked with 911 labels.
 * Bus Stop remains the roadside shuttle POI — never Bus Parking #1194.
 */
export const GROUNDS_ZONES: GroundsZone[] = [
  {
    id: 'bus-stop',
    label: 'Bus Stop',
    rect: { x: 33.333, y: 34.347, w: 3.943, h: 1.994 },
    polygon: [
      [33.333, 35.145], [33.78, 34.546], [35.045, 34.347], [37.202, 35.294],
      [34.97, 36.291], [33.929, 36.142], [33.482, 35.842], [33.333, 35.444],
    ],
    fact: 'Shuttle stop on the site road north of Tented City.',
    action: 'info',
    color: '#7B4EA3',
  },
  {
    id: 'accessible-parking',
    label: 'Accessible Parking',
    rect: { x: 25.372, y: 38.385, w: 4.018, h: 2.094 },
    polygon: [
      [25.372, 39.200], [26.200, 38.385], [27.800, 38.385], [29.390, 39.200],
      [28.200, 40.479], [26.400, 40.479],
    ],
    fact: 'Accessible parking on the site road west of Tented City.',
    action: 'info',
    color: '#3A7BC8',
  },
  {
    id: 'horse-plowing',
    label: 'Horse Plowing',
    rect: { x: 17.857, y: 42.423, w: 8.482, h: 5.683 },
    polygon: [
      [17.857, 44.118], [18.601, 43.32], [24.851, 42.423], [25.893, 45.513],
      [26.116, 47.208], [19.271, 48.056], [18.75, 47.458],
    ],
    fact: 'Horse Plowing.',
    action: 'info',
    color: '#E6C229',
  },
  {
    id: 'tented-city',
    label: 'Tented City',
    rect: { x: 31.473, y: 37.139, w: 14.955, h: 10.668 },
    polygon: [
      [44.196, 37.139], [31.548, 38.734], [34.003, 47.757], [41.295, 46.81],
      [40.923, 44.716], [46.354, 44.018],
    ],
    fact: 'Open the Tented City map for exhibitors, food, and stages.',
    action: 'switch-tented',
    color: '#E07A2F',
  },
  {
    id: 'north-parking',
    label: 'North Parking Lot',
    rect: { x: 18.304, y: 47.159, w: 14.435, h: 9.721 },
    polygon: [
      [18.304, 48.754], [30.06, 47.159], [32.664, 55.284], [20.833, 56.83], [19.866, 54.487],
    ],
    fact: 'Parking is free.',
    action: 'info',
    color: '#3A7BC8',
  },
  {
    id: 'rv-park',
    label: 'RV Park',
    rect: { x: 36.012, y: 50.648, w: 13.542, h: 7.378 },
    polygon: [
      [36.012, 52.393], [41.815, 51.396], [47.991, 50.798], [49.479, 56.431], [37.723, 57.926],
    ],
    fact: 'RV Park.',
    action: 'info',
    color: '#7B4EA3',
  },
  {
    id: 'west-parking',
    label: 'West Parking Lot',
    rect: { x: 35.64, y: 57.378, w: 29.464, h: 15.653 },
    polygon: [
      [49.479, 57.378], [35.64, 59.372], [39.435, 72.981], [65.03, 69.641],
      [63.393, 63.958], [51.86, 63.858], [49.926, 57.378],
    ],
    fact: 'Parking is free.',
    action: 'info',
    color: '#3A7BC8',
  },
  {
    id: 'tractor-plowing',
    label: 'Tractor Plowing',
    rect: { x: 62.128, y: 35.444, w: 24.33, h: 24.128 },
    polygon: [
      [62.128, 37.737], [78.869, 35.444], [86.384, 57.328], [68.973, 59.521],
    ],
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
  camping: 'rv-park',
  'rv camping': 'rv-park',
  'rv park camping': 'rv-park',
  'horse plowing': 'horse-plowing',
  'tractor plowing': 'tractor-plowing',
  // Schedule parent name (~13 events). Prefer larger tractor field when Horse/Tractor is not distinguished.
  'plowing fields': 'tractor-plowing',
  'plowing field': 'tractor-plowing',
  'west parking lot': 'west-parking',
  'west parking': 'west-parking',
  'north parking lot': 'north-parking',
  'north parking': 'north-parking',
  'bus stop': 'bus-stop',
  // Shuttle pickup/dropoff POI only — never Bus Parking #1194 (no geometry; distinct destination).
  shuttle: 'bus-stop',
  'shuttle stop': 'bus-stop',
  'shuttle stops': 'bus-stop',
  'shuttle pickup': 'bus-stop',
  'shuttle dropoff': 'bus-stop',
  pickup: 'bus-stop',
  dropoff: 'bus-stop',
  'drop off': 'bus-stop',
  // Grounds wheelchair icon (displayed artwork). TC strip stays the schedule semantic.
  'accessible parking (grounds)': 'accessible-parking',
  'grounds accessible parking': 'accessible-parking',
  'accessible parking': 'accessible-parking',
};

/**
 * When schedule location_name is the generic Plowing Fields parent, prefer Horse/Tractor
 * zone if the event title clearly distinguishes them; otherwise keep Plowing Fields
 * (alias → tractor-plowing).
 */
export function resolvePlowingMapLocation(
  locationName: string | null | undefined,
  title?: string | null,
): string | null | undefined {
  if (!locationName) return locationName;
  const key = normalizeZoneQuery(locationName);
  if (key !== 'plowing fields' && key !== 'plowing field') return locationName;
  const t = (title || '').toLowerCase();
  const hasHorse = /\bhorse\b/.test(t);
  const hasTractor = /\btractor\b/.test(t);
  if (hasHorse && !hasTractor) return 'Horse Plowing';
  if (hasTractor && !hasHorse) return 'Tractor Plowing';
  return locationName;
}

export function resolveGroundsZone(name: string | null | undefined): GroundsZone | null {
  if (!name) return null;
  const key = normalizeZoneQuery(name);
  if (!key) return null;
  const id = GROUNDS_ZONE_ALIASES[key];
  return id ? zoneById(id) : null;
}

/** Ray-cast point-in-polygon in percent space. */
export function pointInGroundsPolygon(x: number, y: number, polygon: GroundsPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y) {
      const denom = yj - yi;
      if (denom !== 0 && x < ((xj - xi) * (y - yi)) / denom + xi) inside = !inside;
    }
  }
  return inside;
}

function polygonArea(polygon: GroundsPoint[]): number {
  let sum = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    sum += polygon[j][0] * polygon[i][1] - polygon[i][0] * polygon[j][1];
  }
  return Math.abs(sum) / 2;
}

export function hitTestGroundsZone(x: number, y: number): GroundsZone | null {
  let best: GroundsZone | null = null;
  let bestArea = Infinity;
  for (const zone of GROUNDS_ZONES) {
    const hit = zone.polygon?.length
      ? pointInGroundsPolygon(x, y, zone.polygon)
      : (() => {
          const r = zone.rect;
          return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
        })();
    if (!hit) continue;
    const area = zone.polygon?.length ? polygonArea(zone.polygon) : zone.rect.w * zone.rect.h;
    if (area < bestArea) {
      best = zone;
      bestArea = area;
    }
  }
  return best;
}
