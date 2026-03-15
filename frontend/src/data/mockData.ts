// Mock Data for Event Navigator - Phase 2
// Centered around Moscone Center, San Francisco (37.7842, -122.4016)

export type LocationType = 'stage' | 'vendor' | 'utility';
export type UtilitySubtype = 'food' | 'restroom' | 'info' | 'medical' | 'general';

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: LocationType;
  utilitySubtype?: UtilitySubtype;
}

export interface Vendor {
  id: string;
  name: string;
  description: string;
  location_id: string;
}

export interface Session {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location_id: string;
}

// Moscone Center venue coordinates
export const VENUE_CENTER = {
  latitude: 37.7842,
  longitude: -122.4016,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

// Google Maps API Key placeholder
export const GOOGLE_MAPS_API_KEY = 'GOOGLE_MAPS_API_KEY_PLACEHOLDER';

// Locations around Moscone Center
export const locations: Location[] = [
  {
    id: 'loc-1',
    name: 'Main Stage',
    lat: 37.7845,
    lng: -122.4020,
    type: 'stage',
  },
  {
    id: 'loc-2',
    name: 'Innovation Hall',
    lat: 37.7840,
    lng: -122.4010,
    type: 'stage',
  },
  {
    id: 'loc-3',
    name: 'Workshop Room A',
    lat: 37.7838,
    lng: -122.4025,
    type: 'stage',
  },
  {
    id: 'loc-4',
    name: 'TechCorp Booth',
    lat: 37.7848,
    lng: -122.4012,
    type: 'vendor',
  },
  {
    id: 'loc-5',
    name: 'CloudSoft Pavilion',
    lat: 37.7835,
    lng: -122.4018,
    type: 'vendor',
  },
  {
    id: 'loc-6',
    name: 'AI Solutions Hub',
    lat: 37.7843,
    lng: -122.4005,
    type: 'vendor',
  },
  {
    id: 'loc-7',
    name: 'Food Court',
    lat: 37.7850,
    lng: -122.4022,
    type: 'utility',
    utilitySubtype: 'food',
  },
  {
    id: 'loc-8',
    name: 'Restrooms - North',
    lat: 37.7852,
    lng: -122.4015,
    type: 'utility',
    utilitySubtype: 'restroom',
  },
  {
    id: 'loc-9',
    name: 'Information Desk',
    lat: 37.7842,
    lng: -122.4016,
    type: 'utility',
    utilitySubtype: 'info',
  },
  {
    id: 'loc-10',
    name: 'First Aid Station',
    lat: 37.7833,
    lng: -122.4008,
    type: 'utility',
    utilitySubtype: 'medical',
  },
];

// Vendors at the event
export const vendors: Vendor[] = [
  {
    id: 'vendor-1',
    name: 'TechCorp Industries',
    description: 'Leading provider of enterprise software solutions. Visit us for live demos of our latest AI-powered tools.',
    location_id: 'loc-4',
  },
  {
    id: 'vendor-2',
    name: 'CloudSoft',
    description: 'Cloud infrastructure and DevOps automation. Free swag and consultations available!',
    location_id: 'loc-5',
  },
  {
    id: 'vendor-3',
    name: 'AI Solutions Inc.',
    description: 'Machine learning platforms for modern businesses. Experience our demo zone.',
    location_id: 'loc-6',
  },
];

// Get today's date for demo purposes - sessions are happening "today"
const getToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const TODAY = getToday();

// Sessions/Events schedule - using dynamic dates for demo
export const sessions: Session[] = [
  {
    id: 'session-1',
    title: 'Opening Keynote: Future of Technology',
    start_time: `${TODAY}T09:00:00`,
    end_time: `${TODAY}T10:30:00`,
    location_id: 'loc-1',
  },
  {
    id: 'session-2',
    title: 'Building Scalable Applications',
    start_time: `${TODAY}T11:00:00`,
    end_time: `${TODAY}T12:00:00`,
    location_id: 'loc-2',
  },
  {
    id: 'session-3',
    title: 'Hands-on: React Native Workshop',
    start_time: `${TODAY}T13:00:00`,
    end_time: `${TODAY}T15:00:00`,
    location_id: 'loc-3',
  },
  {
    id: 'session-4',
    title: 'AI/ML in Production',
    start_time: `${TODAY}T15:30:00`,
    end_time: `${TODAY}T16:30:00`,
    location_id: 'loc-2',
  },
  {
    id: 'session-5',
    title: 'Closing Ceremony & Networking',
    start_time: `${TODAY}T17:00:00`,
    end_time: `${TODAY}T18:30:00`,
    location_id: 'loc-1',
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
      return '#FF6B6B'; // Red for stages
    case 'vendor':
      return '#4ECDC4'; // Teal for vendors
    case 'utility':
      return '#FFE66D'; // Yellow for utilities
    default:
      return '#FFFFFF';
  }
};

// Enhanced icon function with utility subtypes
export const getLocationTypeIcon = (type: LocationType, utilitySubtype?: UtilitySubtype): string => {
  if (type === 'utility' && utilitySubtype) {
    switch (utilitySubtype) {
      case 'food':
        return 'coffee'; // Coffee/food icon
      case 'restroom':
        return 'users'; // People icon for restrooms
      case 'info':
        return 'help-circle'; // Help/info icon
      case 'medical':
        return 'heart'; // Heart for medical/first aid
      default:
        return 'info';
    }
  }
  
  switch (type) {
    case 'stage':
      return 'mic'; // Microphone for stages
    case 'vendor':
      return 'shopping-bag'; // Shopping bag for vendors
    case 'utility':
      return 'info'; // Default info for utilities
    default:
      return 'map-pin';
  }
};

// Get sessions happening now (within current hour)
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
