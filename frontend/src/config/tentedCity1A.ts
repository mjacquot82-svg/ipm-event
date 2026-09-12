import type { Rect, TentedCityVendor } from './tentedCityTypes';
import { AREA_BY_LABEL, TENTED_CITY_LOTS, unionRects } from './tentedCityGeometry';
import { footprintForVendor } from './tentedCityVendorMatch';

/** 1A adapter over PDF geometry. Percents are of tented-city-map.png (full page 17). */
export type TentedCity1AParent = {
  id: string;
  label: string;
  from: number;
  to: number;
  lotCount: number;
  rect: Rect;
};

export type TentedCity1ALot = {
  id: string;
  parentId: string;
  n: number;
  rect: Rect;
};

function parentIdFromLabel(label: string) {
  if (label === '1A 1-12') return '1A-01-12';
  if (label === '1A 13-24') return '1A-13-24';
  if (label === '1A 25-38') return '1A-25-38';
  return label;
}

export const TENTED_CITY_1A_PARENTS: TentedCity1AParent[] = (['1A 1-12', '1A 13-24', '1A 25-38'] as const).map((label) => {
  const area = AREA_BY_LABEL.get(label)!;
  return {
    id: parentIdFromLabel(label),
    label,
    from: area.lot_start || 0,
    to: area.lot_end || 0,
    lotCount: area.n_lots,
    rect: area.rect,
  };
});

export const TENTED_CITY_1A_LOTS: TentedCity1ALot[] = TENTED_CITY_LOTS.filter((lot) => lot.id.startsWith('1A-')).map((lot) => ({
  id: lot.id,
  parentId: parentIdFromLabel(lot.parent),
  n: lot.n,
  rect: lot.rect,
}));

const LOT_BY_ID = new Map(TENTED_CITY_1A_LOTS.map((lot) => [lot.id, lot]));

export function is1ABoothId(id: string) {
  return /^1A-\d{2}$/.test(id);
}

export function get1ALot(id: string) {
  return LOT_BY_ID.get(id);
}

export { unionRects };

/** @deprecated Use footprintForVendor. Kept for 1A-only callers. */
export function footprintFor1AVendor(vendor: TentedCityVendor): { lotIds: string[]; rect: Rect; parent: TentedCity1AParent | null } | null {
  const ids = (vendor.booths || []).filter(is1ABoothId);
  if (!ids.length || ids.length !== vendor.booths.length) return null;
  const fp = footprintForVendor(vendor);
  if (!fp) return null;
  const parent = TENTED_CITY_1A_PARENTS.find((p) => p.id === parentIdFromLabel(TENTED_CITY_LOTS.find((l) => l.id === ids[0])?.parent || '')) || null;
  return { lotIds: ids, rect: fp.rect, parent };
}

export function focusRectFor1A(lotRect: Rect, parent: TentedCity1AParent | null): Rect {
  const base = parent?.rect || lotRect;
  return {
    x: base.x - 3.5,
    y: base.y - 8,
    w: base.w + 7,
    h: base.h + 16,
  };
}
