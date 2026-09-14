export const GROUNDS_VIEWS = ['general', 'parking'] as const;
export type GroundsView = typeof GROUNDS_VIEWS[number];
export type GroundsParkingPoi = {
  id: string;
  label: string;
  detail?: string;
  x: number;
  y: number;
  confidence: 'HIGH' | 'MEDIUM';
  /** Screen-pixel label offsets; leader dots retain the geographic anchor. */
  offset: readonly [number, number];
};

// Entrances (8-26-2026), cross-checked with the same-date 911 aerial and the
// existing Grounds JPEG. Approximate arrival locations, not surveyed gates.
// See docs/grounds-layers-prototype.md for source/anchor reconciliation.
export const GROUNDS_PARKING_POIS: readonly GroundsParkingPoi[] = [
  { id: '1', label: 'Tented City Entrance', detail: 'Buses Only', x: 40.39, y: 36.64, confidence: 'MEDIUM', offset: [28, 18] },
  { id: '2', label: 'Tented City Entrance', detail: 'Buses Only', x: 35.97, y: 37.33, confidence: 'MEDIUM', offset: [0, -18] },
  { id: '3', label: 'Bus Parking', x: 34.2, y: 33, confidence: 'MEDIUM', offset: [-20, -18] },
  { id: '4A', label: 'Tented City Entrance', x: 30.24, y: 42.97, confidence: 'MEDIUM', offset: [-18, 0] },
  { id: '4B', label: 'Tented City Entrance', x: 30.81, y: 44.77, confidence: 'MEDIUM', offset: [16, 3] },
  { id: '5', label: 'Exhibitor Entrance', x: 31.76, y: 47.9, confidence: 'MEDIUM', offset: [32, 14] },
  { id: '7', label: 'North Parking Entrance', x: 31.11, y: 50.1, confidence: 'MEDIUM', offset: [-18, 0] },
  { id: '8', label: 'North Parking Entrance', x: 32.7, y: 54.99, confidence: 'MEDIUM', offset: [-18, 0] },
  { id: '9', label: 'RV Park Entrance', x: 35.13, y: 58.45, confidence: 'MEDIUM', offset: [20, -8] },
  { id: '10', label: 'West Parking Entrance', x: 35.32, y: 58.97, confidence: 'MEDIUM', offset: [-18, 12] },
  { id: '11', label: 'West Parking Entrance', x: 37.4, y: 65.26, confidence: 'MEDIUM', offset: [-18, 0] },
  { id: '12', label: 'West Parking Entrance', x: 38.9, y: 69.93, confidence: 'MEDIUM', offset: [-18, 0] },
  { id: '13', label: 'West Parking Entrance', x: 51.44, y: 70.79, confidence: 'MEDIUM', offset: [0, 20] },
  { id: '14', label: 'West Parking Entrance', x: 59.55, y: 69.69, confidence: 'MEDIUM', offset: [0, 20] },
  { id: 'accessible', label: 'Accessible Parking', x: 27.38, y: 39.43, confidence: 'HIGH', offset: [-32, -8] },
];

export function hitGroundsParking(x: number, y: number, width: number, height: number, scale: number) {
  const zoom = Math.max(1, scale);
  return GROUNDS_PARKING_POIS.map(poi => ({ poi, distance: Math.hypot(
    (x - poi.x * width / 100) * zoom - poi.offset[0],
    (y - poi.y * height / 100) * zoom - poi.offset[1],
  ) })).filter(hit => hit.distance <= 20).sort((a, b) => a.distance - b.distance)[0]?.poi || null;
}
