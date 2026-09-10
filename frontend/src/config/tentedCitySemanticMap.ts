import manifest from '../data/tented-city-map-manifest.json';
import type { Rect, TentedCityVendor } from './tentedCityTypes';
import type { GeometryArea } from './tentedCityGeometry';

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

// These are published schedule labels whose wording differs from the audited
// map manifest. Keep this list explicit so an unknown location stays unmapped.
const LOCATION_ALIASES: Record<string, string> = {
  'EVENT CENTRE 1 WEST 2': 'dancing-tractors-combine-derby-west-2',
};

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

export function findSemanticAreaForLocation(query: string): SemanticMapArea | null {
  const direct = findSemanticArea(query);
  if (direct) return direct;
  const aliasId = LOCATION_ALIASES[normalize(query)];
  return aliasId ? TENTED_CITY_SEMANTIC_AREAS.find((area) => area.id === aliasId) || null : null;
}

/** Exact label matching only; no individual booth position is inferred from a range. */
export function findSemanticAreaForVendor(vendor: Pick<TentedCityVendor, 'booths' | 'locationLabel'>): SemanticMapArea | null {
  const labels = [...(vendor.booths || []), vendor.locationLabel || ''].map(normalize).filter(Boolean);
  return TENTED_CITY_SEMANTIC_AREAS.find((area) => labels.includes(normalize(area.label))) || null;
}

/** Resolve audited geometry ranges using the official SVG manifest labels. */
export function findSemanticAreaForGeometryArea(area: Pick<GeometryArea, 'section' | 'lot_start' | 'lot_end' | 'label'>): SemanticMapArea | null {
  const section = area.section?.toUpperCase();
  if (!section || area.lot_start == null || area.lot_end == null) return findSemanticArea(area.label);
  const range = new RegExp(`\\b${section}\\s*[- ]?${area.lot_start}\\s*[-–]\\s*${area.lot_end}\\b`, 'i');
  return TENTED_CITY_SEMANTIC_AREAS.find((candidate) => range.test(candidate.label)) || findSemanticArea(area.label);
}
