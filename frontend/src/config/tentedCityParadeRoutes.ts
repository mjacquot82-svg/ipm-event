/** Official route PDFs in data/, interpreted with Marc's 2026-09-19 approval.
 * Coordinates are PDF points in the unchanged base SVG viewBox 0 0 774 603.
 * Road lanes are offset from printed street labels, never from their corridors.
 */
export type ParadeRouteId = 'tuesday' | 'wed-sat';
export type RoutePoint = readonly [number, number];
export type RouteArrow = { at: RoutePoint; direction: 'north' | 'south' | 'east' | 'west' };
export const PARADE_VIEWBOX = '0 0 774 603';
export const PARADE_ASSEMBLY = {
  outline: '513,111 538,111 538,216 519,216 519,139 493,139 493,121 513,121',
  gate: [503, 139] as RoutePoint,
  label: [529, 179] as RoutePoint,
};
// PENDING ORGANIZER CLARIFICATION — CURRENTLY EXCLUDED.
// Keep separate from active routes; no attendee-facing uncertainty note.
export const PENDING_MUTUAL_SQUARE_SEGMENT: readonly RoutePoint[] = [[344, 313], [444, 313]];

const ENTRY: readonly RoutePoint[] = [PARADE_ASSEMBLY.gate, [503, 148], [444, 148], [444, 192]];
const ENTRY_ARROWS: RouteArrow[] = [
  { at: [477, 148], direction: 'west' }, { at: [444, 168], direction: 'south' },
];
export const PARADE_ROUTES: Record<ParadeRouteId, {
  id: ParadeRouteId; label: string; source: string; roads: readonly string[];
  paths: readonly (readonly RoutePoint[])[]; arrows: readonly RouteArrow[];
}> = {
  tuesday: {
    id: 'tuesday', label: 'Tuesday', source: 'IPM 2026 Tented City Map - Parade Route Tues.pdf',
    roads: ['Bruce County North', 'Hydro One Avenue', 'First Street', 'Dodge Avenue',
      'Fifth Street', 'Bruce Power Avenue', 'Second Street', 'Grain Farmers Avenue',
      'Fifth Street', 'Hydro One Avenue', 'First Street'],
    paths: [ENTRY, [[444,192],[142,192],[142,437],[241,437],[241,247.5],[344,247.5],[344,437],[444,437],[444,192]]],
    arrows: [...ENTRY_ARROWS,
      { at: [330,192], direction: 'west' }, { at: [142,210], direction: 'south' },
      { at: [142,405], direction: 'south' }, { at: [195,437], direction: 'east' },
      { at: [241,375], direction: 'north' }, { at: [310,247.5], direction: 'east' },
      { at: [344,355], direction: 'south' }, { at: [395,437], direction: 'east' },
      { at: [444,360], direction: 'north' }, { at: [444,210], direction: 'north' }],
  },
  'wed-sat': {
    id: 'wed-sat', label: 'Wednesday–Saturday', source: 'IPM 2026 Tented City Map - Parade Route Wed to Sat.pdf',
    roads: ['Bruce County North', 'Hydro One Avenue', 'First Street', 'Dodge Avenue',
      'Fifth Street', 'Hydro One Avenue', 'First Street'],
    paths: [ENTRY, [[444,192],[142,192],[142,437],[444,437],[444,192]]],
    arrows: [...ENTRY_ARROWS,
      { at: [330,192], direction: 'west' }, { at: [142,210], direction: 'south' },
      { at: [142,345], direction: 'south' }, { at: [240,437], direction: 'east' },
      { at: [444,415], direction: 'north' }, { at: [444,330], direction: 'north' },
      { at: [444,205], direction: 'north' }],
  },
};
export function paradePath(points: readonly RoutePoint[]) {
  return points.map(([x,y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
}
