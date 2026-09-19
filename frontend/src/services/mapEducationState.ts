export const EDUCATION_KEYS = {
  mapsTourSeen: '@ipm_maps_tour_seen_v1',
  scheduleFindOnMapTipSeen: '@ipm_schedule_find_on_map_tip_seen_v1',
  scheduleEventDetailsTipSeen: '@ipm_schedule_event_details_tip_seen_v1',
  vendorFindOnMapTipSeen: '@ipm_vendor_find_on_map_tip_seen_v1',
} as const;
export type EducationKind = keyof typeof EDUCATION_KEYS;
export const MAP_TOUR_STEPS = [
  { target: 'grounds', map: 'grounds', title: 'Find parking', body: 'Parking areas are shown on the Grounds map. The optional Parking view adds entrance markers.' },
  { target: 'tented-search', map: 'tented', title: 'Find a place', body: 'On Tented City, search for a vendor, booth, stage or place. Select a result to highlight its location.' },
  { target: 'parade-routes', map: 'tented', title: 'Follow the parade', body: 'Tap Parade Routes to expand it. Choose Tuesday or Wednesday–Saturday. The blue line and arrows show that day’s route. Select Off to hide it.' },
  { target: 'tented-reset', map: 'tented', title: 'Move around the map', body: 'Drag to move and pinch to zoom. Use this reset button to fit the map again.' },
  { target: 'rv', map: 'tented', title: 'Find your campsite', body: 'Open Camping Map to find individual RV and campsite locations.' },
] as const;
