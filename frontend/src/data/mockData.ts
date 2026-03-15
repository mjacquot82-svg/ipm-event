// Mock Data for Event Navigator - Phase 1
// Centered around Moscone Center, San Francisco (37.7842, -122.4016)

export type LocationType = 'stage' | 'vendor' | 'utility';

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: LocationType;
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
  },
  {
    id: 'loc-8',
    name: 'Restrooms - North',
    lat: 37.7852,
    lng: -122.4015,
    type: 'utility',
  },
  {
    id: 'loc-9',
    name: 'Information Desk',
    lat: 37.7842,
    lng: -122.4016,
    type: 'utility',
  },
  {
    id: 'loc-10',
    name: 'First Aid Station',
    lat: 37.7833,
    lng: -122.4008,
    type: 'utility',
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

// Sessions/Events schedule
export const sessions: Session[] = [
  {
    id: 'session-1',
    title: 'Opening Keynote: Future of Technology',
    start_time: '2025-07-15T09:00:00',
    end_time: '2025-07-15T10:30:00',
    location_id: 'loc-1',
  },
  {
    id: 'session-2',
    title: 'Building Scalable Applications',
    start_time: '2025-07-15T11:00:00',
    end_time: '2025-07-15T12:00:00',
    location_id: 'loc-2',
  },
  {
    id: 'session-3',
    title: 'Hands-on: React Native Workshop',
    start_time: '2025-07-15T13:00:00',
    end_time: '2025-07-15T15:00:00',
    location_id: 'loc-3',
  },
  {
    id: 'session-4',
    title: 'AI/ML in Production',
    start_time: '2025-07-15T15:30:00',
    end_time: '2025-07-15T16:30:00',
    location_id: 'loc-2',
  },
  {
    id: 'session-5',
    title: 'Closing Ceremony & Networking',
    start_time: '2025-07-15T17:00:00',
    end_time: '2025-07-15T18:30:00',
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

export const getLocationTypeIcon = (type: LocationType): string => {
  switch (type) {
    case 'stage':
      return 'mic'; // Microphone for stages
    case 'vendor':
      return 'shopping-bag'; // Shopping bag for vendors
    case 'utility':
      return 'info'; // Info for utilities
    default:
      return 'map-pin';
  }
};
