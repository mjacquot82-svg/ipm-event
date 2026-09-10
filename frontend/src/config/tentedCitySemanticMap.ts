import manifest from '../data/tented-city-map-manifest.json';
import type { Rect, TentedCityVendor } from './tentedCityTypes';

export const TENTED_CITY_SEMANTIC_VIEWBOX = { width: 774, height: 603 } as const;

export type SemanticMapArea = {
  id: string;
  label: string;
  category: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const TENTED_CITY_SEMANTIC_AREAS = manifest.areas as SemanticMapArea[];

const normalize = (value: string) => value.toUpperCase().replace(/[\u2019']/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();

/** Convert the supplied PDF-point region into the map's existing percentage coordinate space. */
export function semanticAreaRect(area: SemanticMapArea): Rect {
  return {
    x: (area.x / TENTED_CITY_SEMANTIC_VIEWBOX.width) * 100,
    y: (area.y / TENTED_CITY_SEMANTIC_VIEWBOX.height) * 100,
    w: (area.width / TENTED_CITY_SEMANTIC_VIEWBOX.width) * 100,
    h: (area.height / TENTED_CITY_SEMANTIC_VIEWBOX.height) * 100,
  };
}

export function findSemanticArea(query: string): SemanticMapArea | null {
  const key = normalize(query);
  if (!key) return null;
  return TENTED_CITY_SEMANTIC_AREAS.find((area) => normalize(area.id) === key || normalize(area.label) === key) || null;
}

/** Exact label matching only; no individual booth position is inferred from a range. */
export function findSemanticAreaForVendor(vendor: Pick<TentedCityVendor, 'booths' | 'locationLabel'>): SemanticMapArea | null {
  const labels = [...(vendor.booths || []), vendor.locationLabel || ''].map(normalize).filter(Boolean);
  return TENTED_CITY_SEMANTIC_AREAS.find((area) => labels.includes(normalize(area.label))) || null;
}
