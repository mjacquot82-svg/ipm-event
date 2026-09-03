export type Rect = { x: number; y: number; w: number; h: number };

export type TentedCityVendor = {
  name: string;
  category: 'outdoor' | 'indoor' | 'food' | string;
  tent: string | null;
  locationLabel: string;
  booths: string[];
  rect: Rect | null;
};

export type TentedCityVenue = {
  id: string;
  label: string;
  names: string[];
  kind: 'stage' | 'landmark';
  rect: Rect | null;
  note?: string;
};

export type TentedCityPlace =
  | { kind: 'vendor'; vendor: TentedCityVendor }
  | { kind: 'stage'; venue: TentedCityVenue };

/**
 * Overlay coordinates are percentages of the official map image.
 * Geographic calibration is not available yet, so visitor GPS / walking
 * directions must not be enabled until geoBounds is filled from a surveyed match.
 */
export const TENTED_CITY_MAP = {
  imageWidth: 1935,
  imageHeight: 1508,
  coordinateSpace: 'percent' as const,
  geoBounds: null as null | {
    north: number;
    south: number;
    east: number;
    west: number;
  },
};
