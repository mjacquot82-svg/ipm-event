export const EDUCATION_KEYS = {
  mapsTourSeen: '@ipm_maps_tour_seen_v1',
  scheduleFindOnMapTipSeen: '@ipm_schedule_find_on_map_tip_seen_v1',
  scheduleEventDetailsTipSeen: '@ipm_schedule_event_details_tip_seen_v1',
  vendorFindOnMapTipSeen: '@ipm_vendor_find_on_map_tip_seen_v1',
} as const;
export type EducationKind = keyof typeof EDUCATION_KEYS;
export const MAP_TOUR_STEPS = [
  { target: 'parking', title: 'Find parking', body: 'Tap Parking for entrances, bus drop-off and accessible parking.' },
  { target: 'tented', title: 'Explore Tented City', body: 'Open Tented City to explore the grounds, stages and booth areas. Pinch to zoom and drag to move around.' },
  { target: 'rv', title: 'Find your campsite', body: 'Open Camping Map to find individual RV and campsite locations.' },
] as const;
