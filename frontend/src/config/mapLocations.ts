// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Map Pin Locations Configuration
// Coordinates are percentages (0-100) of the map image dimensions
// Adjust these values as you learn more about the venue layout

export type LocationCategory = 'stage' | 'tent' | 'field' | 'campground' | 'vendor' | 'parking' | 'entrance' | 'other';

export interface MapLocation {
  id: string;
  name: string;           // Must match the "Location" column in Google Sheets
  category: LocationCategory;
  x: number;              // X position as percentage (0-100) from left
  y: number;              // Y position as percentage (0-100) from top
  description?: string;
}

// Pin colors by category
export const categoryColors: Record<LocationCategory, string> = {
  stage: '#A6262D',       // Deep Red
  tent: '#3DBDB5',        // Teal
  field: '#5A7A1F',       // Olive Green
  campground: '#3A7BC8',  // Blue
  vendor: '#D4920A',      // Harvest Gold
  parking: '#8A8986',     // Gray
  entrance: '#9C27B0',    // Purple
  other: '#5C5856',       // Dark Gray
};

// Pin icons by category
export const categoryIcons: Record<LocationCategory, string> = {
  stage: 'mic',
  tent: 'home',
  field: 'sun',
  campground: 'moon',
  vendor: 'shopping-bag',
  parking: 'truck',
  entrance: 'log-in',
  other: 'map-pin',
};

// Map locations - UPDATE THESE COORDINATES AS YOU LEARN THE VENUE LAYOUT
// The event field is south of Durham Rd, left of Hwy 3
// Campground is at the bottom between two treed areas
export const mapLocations: MapLocation[] = [
  // === CAMPGROUND ===
  {
    id: 'campground',
    name: 'Campground',
    category: 'campground',
    x: 25,    // Between the two treed areas at bottom of field
    y: 85,   
    description: 'Camping area - between the treed sections',
  },
  
  // === STAGES (Placeholder positions - adjust when known) ===
  {
    id: 'main-stage',
    name: 'Main Stage',
    category: 'stage',
    x: 50,
    y: 30,
    description: 'Main entertainment stage',
  },
  {
    id: 'stage-2',
    name: 'Stage 2',
    category: 'stage',
    x: 70,
    y: 45,
    description: 'Secondary stage',
  },
  
  // === TENTS (Placeholder positions - adjust when known) ===
  {
    id: 'tent-1',
    name: 'Tent 1',
    category: 'tent',
    x: 35,
    y: 40,
    description: 'Exhibition tent 1',
  },
  {
    id: 'tent-2',
    name: 'Tent 2',
    category: 'tent',
    x: 45,
    y: 50,
    description: 'Exhibition tent 2',
  },
  {
    id: 'tent-3',
    name: 'Tent 3',
    category: 'tent',
    x: 55,
    y: 55,
    description: 'Exhibition tent 3',
  },
  {
    id: 'vendor-tent-a',
    name: 'Vendor Tent A',
    category: 'vendor',
    x: 30,
    y: 60,
    description: 'Vendor area A',
  },
  
  // === FIELDS (Placeholder positions - adjust when known) ===
  {
    id: 'field-1',
    name: 'Field 1',
    category: 'field',
    x: 60,
    y: 65,
    description: 'Plowing competition field 1',
  },
  {
    id: 'field-2',
    name: 'Field 2',
    category: 'field',
    x: 75,
    y: 70,
    description: 'Plowing competition field 2',
  },
  {
    id: 'north-field',
    name: 'North Field',
    category: 'field',
    x: 50,
    y: 20,
    description: 'Northern demonstration field',
  },
  
  // === PARKING ===
  {
    id: 'parking-main',
    name: 'Main Parking',
    category: 'parking',
    x: 15,
    y: 25,
    description: 'Main parking area',
  },
  
  // === ENTRANCES ===
  {
    id: 'main-entrance',
    name: 'Main Entrance',
    category: 'entrance',
    x: 20,
    y: 15,
    description: 'Main event entrance',
  },
];

// Helper function to find a location by name (case-insensitive partial match)
export const findLocationByName = (name: string): MapLocation | undefined => {
  if (!name) return undefined;
  const lowerName = name.toLowerCase().trim();
  
  // First try exact match
  const exactMatch = mapLocations.find(
    loc => loc.name.toLowerCase() === lowerName
  );
  if (exactMatch) return exactMatch;
  
  // Then try partial match
  return mapLocations.find(
    loc => loc.name.toLowerCase().includes(lowerName) ||
           lowerName.includes(loc.name.toLowerCase())
  );
};

// Helper to get all location names for autocomplete
export const getAllLocationNames = (): string[] => {
  return mapLocations.map(loc => loc.name);
};

export default mapLocations;
