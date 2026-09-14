export const EDUCATION_KEYS = {
  mapsTourSeen: '@ipm_maps_tour_seen_v1',
  scheduleFindOnMapTipSeen: '@ipm_schedule_find_on_map_tip_seen_v1',
  vendorFindOnMapTipSeen: '@ipm_vendor_find_on_map_tip_seen_v1',
} as const;
export type EducationKind = keyof typeof EDUCATION_KEYS;
export const MAP_TOUR_STEPS = [
  { target: 'parking', title: 'Parking info', body: 'Tap Parking for entrances, bus drop-off and accessible parking.' },
  { target: 'tented', title: 'Find exhibitors', body: 'Open Tented City to find vendors, food and stages.' },
  { target: 'rv', title: 'Find your campsite', body: 'Open Camping Map to find individual RV and campsite locations.' },
  { target: 'search', title: 'Search the maps', body: 'Find a vendor, booth, stage or place.' },
  { target: 'grounds', title: 'Jump straight to a location', body: 'Events and vendors with mapped locations have Find on Map. Tap it to jump directly to the right place.' },
] as const;
