/** Official route PDFs in data/, interpreted with Marc's 2026-09-19 approval.
 * Coordinates are PDF points in the unchanged base SVG viewBox 0 0 774 603.
 * Road centers are measured independently between adjacent SVG roadway edges.
 */
export type ParadeRouteId = 'tuesday' | 'wed-sat';
export type RoutePoint = readonly [number, number];
export type RouteArrow = { at: RoutePoint; direction: 'north' | 'south' | 'east' | 'west' };
export type RouteLabel = { text: string; at: RoutePoint; angle?: 0 | 90 | -90; lines?: readonly string[]; fontSize?: number; maskLength?: number; maskThickness?: number };
export const PARADE_VIEWBOX = '0 0 774 603';
export const PARADE_ASSEMBLY = {
  outline: '513,111 538,111 538,216 519,216 519,139 493,139 493,121 513,121',
  gate: [503, 139] as RoutePoint,
  label: [529, 179] as RoutePoint,
};
// Edges measured from the unchanged SVG paths, in PDF points. Minor row-to-row
// block-edge variations (< 0.4pt) retain one straight avenue centerline.
export const PARADE_ROAD_EDGES = {
  dodge: [132.660156, 161.546875],
  brucePower: [231.945312, 257.015625],
  grainFarmers: [327.414062, 351.210938],
  hydroOne: [426.238281, 447.867188],
  first: [182.199219, 194.265625],
  second: [245.605469, 257.34375],
  fifth: [427.683594, 439.457031],
  bruceCountyNorth: [144.058594, 153.726562],
} as const;
const midpoint = ([a, b]: readonly [number, number]) => (a + b) / 2;
export const PARADE_ROAD_CENTERS = {
  dodge: midpoint(PARADE_ROAD_EDGES.dodge),
  brucePower: midpoint(PARADE_ROAD_EDGES.brucePower),
  grainFarmers: midpoint(PARADE_ROAD_EDGES.grainFarmers),
  hydroOne: midpoint(PARADE_ROAD_EDGES.hydroOne),
  first: midpoint(PARADE_ROAD_EDGES.first),
  second: midpoint(PARADE_ROAD_EDGES.second),
  fifth: midpoint(PARADE_ROAD_EDGES.fifth),
  bruceCountyNorth: midpoint(PARADE_ROAD_EDGES.bruceCountyNorth),
};
const { dodge: D, brucePower: B, grainFarmers: G, hydroOne: H,
  first: F, second: S, fifth: V, bruceCountyNorth: N } = PARADE_ROAD_CENTERS;

// PENDING ORGANIZER CLARIFICATION — CURRENTLY EXCLUDED.
// Keep separate from active routes; no attendee-facing uncertainty note.
export const PENDING_MUTUAL_SQUARE_SEGMENT: readonly RoutePoint[] = [[G, 313], [H, 313]];

const ENTRY: readonly RoutePoint[] = [PARADE_ASSEMBLY.gate, [503, N], [H, N], [H, F]];
const ENTRY_ARROWS: RouteArrow[] = [
  { at: [477, N], direction: 'west' }, { at: [H, 168], direction: 'south' },
];
export const PARADE_ROUTES: Record<ParadeRouteId, {
  id: ParadeRouteId; label: string; source: string; roads: readonly string[];
  paths: readonly (readonly RoutePoint[])[]; arrows: readonly RouteArrow[]; labels: readonly RouteLabel[];
}> = {
  tuesday: {
    id: 'tuesday', label: 'Tuesday', source: 'IPM 2026 Tented City Map - Parade Route Tues.pdf',
    roads: ['Bruce County North', 'Hydro One Avenue', 'First Street', 'Dodge Avenue',
      'Fifth Street', 'Bruce Power Avenue', 'Second Street', 'Grain Farmers Avenue',
      'Fifth Street', 'Hydro One Avenue', 'First Street'],
    paths: [ENTRY, [[H,F],[D,F],[D,V],[B,V],[B,S],[G,S],[G,V],[H,V],[H,F]]],
    arrows: [...ENTRY_ARROWS,
      { at: [330,F], direction: 'west' }, { at: [D,210], direction: 'south' },
      { at: [D,405], direction: 'south' }, { at: [195,V], direction: 'east' },
      { at: [B,375], direction: 'north' }, { at: [310,S], direction: 'east' },
      { at: [G,355], direction: 'south' }, { at: [395,V], direction: 'east' },
      { at: [H,360], direction: 'north' }, { at: [H,210], direction: 'north' }],
    labels: [
      { text: 'Bruce County North', at: [477, N], lines: ['Bruce County', 'North'], fontSize: 6 }, { text: 'Hydro One Avenue', at: [H, 245], angle: -90, lines: ['Hydro', 'One', 'Avenue'], fontSize: 6 },
      { text: 'First Street', at: [375, F] }, { text: 'Dodge Avenue', at: [D, 300], angle: -90 },
      { text: 'Fifth Street', at: [285, V] }, { text: 'Bruce Power Avenue', at: [B, 340], angle: -90, fontSize: 6 },
      { text: 'Second Street', at: [292, S], maskLength: 110, maskThickness: 20 }, { text: 'Grain Farmers Avenue', at: [G, 340], angle: -90, fontSize: 6 },
    ],
  },
  'wed-sat': {
    id: 'wed-sat', label: 'Wednesday–Saturday', source: 'IPM 2026 Tented City Map - Parade Route Wed to Sat.pdf',
    roads: ['Bruce County North', 'Hydro One Avenue', 'First Street', 'Dodge Avenue',
      'Fifth Street', 'Hydro One Avenue', 'First Street'],
    paths: [ENTRY, [[H,F],[D,F],[D,V],[H,V],[H,F]]],
    arrows: [...ENTRY_ARROWS,
      { at: [330,F], direction: 'west' }, { at: [D,210], direction: 'south' },
      { at: [D,345], direction: 'south' }, { at: [240,V], direction: 'east' },
      { at: [H,415], direction: 'north' }, { at: [H,330], direction: 'north' },
      { at: [H,205], direction: 'north' }],
    labels: [
      { text: 'Bruce County North', at: [477, N], lines: ['Bruce County', 'North'], fontSize: 6 }, { text: 'Hydro One Avenue', at: [H, 250], angle: -90, lines: ['Hydro', 'One', 'Avenue'], fontSize: 6 },
      { text: 'First Street', at: [375, F] }, { text: 'Dodge Avenue', at: [D, 300], angle: -90 },
      { text: 'Fifth Street', at: [315, V] },
    ],
  },
};
export function paradePath(points: readonly RoutePoint[]) {
  return points.map(([x,y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
}
