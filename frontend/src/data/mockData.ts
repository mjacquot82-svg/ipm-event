// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

// Mock Data for IPM 2026 - International Plowing Match & Rural Expo
// Walkerton, Bruce County, Ontario
// September 22-26, 2026

export type LocationType = 'stage' | 'vendor' | 'utility' | 'field';
export type UtilitySubtype = 'food' | 'restroom' | 'info' | 'medical' | 'parking' | 'general';
export type FieldSubtype = 'plowing' | 'demo' | 'competition';

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: LocationType;
  utilitySubtype?: UtilitySubtype;
  fieldSubtype?: FieldSubtype;
}

export interface Vendor {
  id: string;
  name: string;
  description: string;
  location_id: string;
  priority?: number;  // 1 = highest priority, 99 = lowest
}

export interface Session {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location_id: string;
}

// IPM 2026 - Walkerton, Bruce County coordinates
export const VENUE_CENTER = {
  latitude: 44.1251,
  longitude: -81.2061,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

// Google Maps API Key placeholder
export const GOOGLE_MAPS_API_KEY = 'GOOGLE_MAPS_API_KEY_PLACEHOLDER';

// Locations around the IPM 2026 site
export const locations: Location[] = [
  // Main Attractions (Stages)
  {
    id: 'loc-1',
    name: 'Main Plowing Field',
    lat: 44.1260,
    lng: -81.2055,
    type: 'field',
    fieldSubtype: 'plowing',
  },
  {
    id: 'loc-2',
    name: 'Rural Expo Stage',
    lat: 44.1245,
    lng: -81.2070,
    type: 'stage',
  },
  {
    id: 'loc-3',
    name: 'Horse Plowing Arena',
    lat: 44.1255,
    lng: -81.2040,
    type: 'field',
    fieldSubtype: 'competition',
  },
  {
    id: 'loc-4',
    name: 'Antique Tractor Display',
    lat: 44.1240,
    lng: -81.2080,
    type: 'field',
    fieldSubtype: 'demo',
  },
  // Vendors/Exhibitors
  {
    id: 'loc-5',
    name: 'Agricultural Equipment Tent',
    lat: 44.1248,
    lng: -81.2050,
    type: 'vendor',
  },
  {
    id: 'loc-6',
    name: 'Local Artisan Market',
    lat: 44.1235,
    lng: -81.2065,
    type: 'vendor',
  },
  {
    id: 'loc-7',
    name: 'Farm Fresh Produce',
    lat: 44.1252,
    lng: -81.2075,
    type: 'vendor',
  },
  // Utilities
  {
    id: 'loc-8',
    name: 'Food Pavilion',
    lat: 44.1242,
    lng: -81.2058,
    type: 'utility',
    utilitySubtype: 'food',
  },
  {
    id: 'loc-9',
    name: 'Restrooms - North',
    lat: 44.1265,
    lng: -81.2060,
    type: 'utility',
    utilitySubtype: 'restroom',
  },
  {
    id: 'loc-10',
    name: 'Information Tent',
    lat: 44.1251,
    lng: -81.2061,
    type: 'utility',
    utilitySubtype: 'info',
  },
  {
    id: 'loc-11',
    name: 'First Aid Station',
    lat: 44.1238,
    lng: -81.2045,
    type: 'utility',
    utilitySubtype: 'medical',
  },
  {
    id: 'loc-12',
    name: 'Main Parking Area',
    lat: 44.1230,
    lng: -81.2090,
    type: 'utility',
    utilitySubtype: 'parking',
  },
];

// Vendors/Exhibitors at IPM 2026
export const vendors: Vendor[] = [
  {
    id: 'vendor-1',
    name: 'Bruce County Farm Equipment',
    description: 'Local dealer showcasing the latest tractors and farming implements. Live demonstrations throughout the day!',
    location_id: 'loc-5',
  },
  {
    id: 'vendor-2',
    name: 'Walkerton Artisan Collective',
    description: 'Handcrafted goods from local artisans including woodwork, textiles, and pottery celebrating rural Ontario heritage.',
    location_id: 'loc-6',
  },
  {
    id: 'vendor-3',
    name: 'Ontario Farm Fresh Market',
    description: 'Fresh seasonal produce, preserves, and baked goods from Bruce County farms.',
    location_id: 'loc-7',
  },
];

// Get today's date for demo purposes - sessions are happening "today"
const getToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const TODAY = getToday();

// Sessions/Events schedule for IPM 2026
export const sessions: Session[] = [
  {
    id: 'session-1',
    title: 'Opening Ceremony - 50 Years Strong',
    start_time: `${TODAY}T09:00:00`,
    end_time: `${TODAY}T10:00:00`,
    location_id: 'loc-2',
  },
  {
    id: 'session-2',
    title: 'Ontario Provincial Plowing Championship',
    start_time: `${TODAY}T10:30:00`,
    end_time: `${TODAY}T12:30:00`,
    location_id: 'loc-1',
  },
  {
    id: 'session-3',
    title: 'Horse Plowing Demonstration',
    start_time: `${TODAY}T13:00:00`,
    end_time: `${TODAY}T14:30:00`,
    location_id: 'loc-3',
  },
  {
    id: 'session-4',
    title: 'Antique Tractor Parade',
    start_time: `${TODAY}T15:00:00`,
    end_time: `${TODAY}T16:00:00`,
    location_id: 'loc-4',
  },
  {
    id: 'session-5',
    title: 'Agricultural Innovation Panel',
    start_time: `${TODAY}T16:30:00`,
    end_time: `${TODAY}T17:30:00`,
    location_id: 'loc-2',
  },
  {
    id: 'session-6',
    title: 'Evening Concert & Celebration',
    start_time: `${TODAY}T18:00:00`,
    end_time: `${TODAY}T21:00:00`,
    location_id: 'loc-2',
  },
];

// Helper functions
export const getLocationById = (id: string): Location | undefined => {
  return locations.find(loc => loc.id === id);
};

export const getVendorByLocationId = (locationId: string): Vendor | undefined => {
  return vendors.find(vendor => vendor.location_id === locationId);
};

export const getSessionsByLocationId = (locationId: string): Session[] => {
  return sessions.filter(session => session.location_id === locationId);
};

export const getSessionById = (id: string): Session | undefined => {
  return sessions.find(session => session.id === id);
};

export const getLocationTypeColor = (type: LocationType): string => {
  switch (type) {
    case 'stage':
      return '#A6262D'; // Deep Red
    case 'vendor':
      return '#F2A900'; // Harvest Gold
    case 'field':
      return '#6B8E23'; // Olive (plowing fields)
    case 'utility':
      return '#4ECDC4'; // Teal
    default:
      return '#F0EFEB';
  }
};

// Enhanced icon function with IPM-specific subtypes
export const getLocationTypeIcon = (type: LocationType, utilitySubtype?: UtilitySubtype, fieldSubtype?: FieldSubtype): string => {
  if (type === 'utility' && utilitySubtype) {
    switch (utilitySubtype) {
      case 'food':
        return 'coffee';
      case 'restroom':
        return 'users';
      case 'info':
        return 'help-circle';
      case 'medical':
        return 'heart';
      case 'parking':
        return 'truck'; // Parking/vehicle icon
      default:
        return 'info';
    }
  }
  
  if (type === 'field' && fieldSubtype) {
    switch (fieldSubtype) {
      case 'plowing':
        return 'grid'; // Field pattern
      case 'demo':
        return 'eye'; // Demonstration
      case 'competition':
        return 'award'; // Competition
      default:
        return 'square';
    }
  }
  
  switch (type) {
    case 'stage':
      return 'mic'; // Microphone for stages
    case 'vendor':
      return 'shopping-bag'; // Shopping bag for vendors
    case 'field':
      return 'grid'; // Grid for fields
    case 'utility':
      return 'info';
    default:
      return 'map-pin';
  }
};

// Get sessions happening now (within current time)
export const getHappeningNow = (): Session[] => {
  const now = new Date();
  return sessions.filter(session => {
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);
    return now >= start && now <= end;
  });
};

// Get upcoming sessions (sorted by start time)
export const getUpcomingSessions = (): Session[] => {
  const now = new Date();
  return sessions
    .filter(session => new Date(session.start_time) > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
};

// Get next starred session
export const getNextStarredSession = (starredIds: string[]): Session | undefined => {
  const now = new Date();
  const starredSessions = sessions
    .filter(session => starredIds.includes(session.id))
    .filter(session => new Date(session.start_time) > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  
  return starredSessions[0];
};

// Event info for About section
export const eventInfo = {
  name: 'International Plowing Match & Rural Expo',
  year: 2026,
  tagline: '50 Years Strong',
  dates: 'September 22-26, 2026',
  location: 'Walkerton, Bruce County, Ontario',
  coordinates: { lat: 44.1251, lng: -81.2061 },
  description: 'Celebrating 50 years of agricultural heritage and innovation in Bruce County. Join us for world-class plowing competitions, rural exhibitions, and community celebration.',
};
