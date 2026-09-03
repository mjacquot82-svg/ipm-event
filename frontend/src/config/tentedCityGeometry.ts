import type { Rect } from './tentedCityTypes';
import geometryAreas from '../data/tented-city-geometry-areas.json';

export const TENTED_CITY_PAGE_PTS = { w: 774, h: 603 };

export type GeometryLot = {
  id: string;
  parent: string;
  n: number;
  rect: Rect;
  flagged: boolean;
};

export type GeometryArea = {
  id: string;
  label: string;
  section: string | null;
  lot_start: number | null;
  lot_end: number | null;
  n_lots: number;
  rect_pts: Rect;
  rect: Rect;
  orientation: string | null;
  split_axis: string | null;
  classification: string;
  confidence: string;
  special_case: boolean;
  flagged: boolean;
};

const data = geometryAreas as {
  areas: GeometryArea[];
  mapping: { formula: string; note: string };
};

export const TENTED_CITY_MAPPING = data.mapping;
export const TENTED_CITY_AREAS: GeometryArea[] = data.areas;
export const TENTED_CITY_RANGE_AREAS = TENTED_CITY_AREAS.filter((a) => a.n_lots > 0);
export const TENTED_CITY_NAMED_AREAS = TENTED_CITY_AREAS.filter((a) => a.n_lots === 0);
/** Hidden 5-tap verify overlay: parents only, never all 326 lots. */
export const TENTED_CITY_VERIFY_PARENTS = TENTED_CITY_AREAS;

export function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export function ptsToPercentRect(pt: Rect): Rect {
  return {
    x: round3((pt.x / TENTED_CITY_PAGE_PTS.w) * 100),
    y: round3((pt.y / TENTED_CITY_PAGE_PTS.h) * 100),
    w: round3((pt.w / TENTED_CITY_PAGE_PTS.w) * 100),
    h: round3((pt.h / TENTED_CITY_PAGE_PTS.h) * 100),
  };
}

export function formatLotId(section: string, n: number) {
  return `${section}-${String(n).padStart(2, '0')}`;
}

/** Even-split lots on the parent long axis. Count = hi-lo+1; never assume 12. */
export function lotsForArea(area: GeometryArea): GeometryLot[] {
  const n = area.n_lots || 0;
  const start = area.lot_start;
  const pts = area.rect_pts;
  if (!n || start == null || !pts || !area.section) return [];
  const lots: GeometryLot[] = [];
  if (area.split_axis === 'B_to_T') {
    const h = pts.h / n;
    for (let i = 0; i < n; i += 1) {
      const num = start + i;
      const y = pts.y + pts.h - (i + 1) * h;
      lots.push({
        id: formatLotId(area.section, num),
        parent: area.label,
        n: num,
        rect: ptsToPercentRect({ x: pts.x, y, w: pts.w, h }),
        flagged: area.flagged,
      });
    }
    return lots;
  }
  const w = pts.w / n;
  for (let i = 0; i < n; i += 1) {
    const num = start + i;
    const x = pts.x + i * w;
    lots.push({
      id: formatLotId(area.section, num),
      parent: area.label,
      n: num,
      rect: ptsToPercentRect({ x, y: pts.y, w, h: pts.h }),
      flagged: area.flagged,
    });
  }
  return lots;
}

export const TENTED_CITY_LOTS: GeometryLot[] = TENTED_CITY_RANGE_AREAS.flatMap(lotsForArea);

export const LOT_BY_ID = new Map(TENTED_CITY_LOTS.map((lot) => [lot.id, lot]));
export const AREA_BY_ID = new Map(TENTED_CITY_AREAS.map((area) => [area.id, area]));
export const AREA_BY_LABEL = new Map(TENTED_CITY_AREAS.map((area) => [area.label, area]));

export function getLot(id: string) {
  return LOT_BY_ID.get(id);
}

export function getArea(id: string) {
  return AREA_BY_ID.get(id);
}

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const rgt = Math.max(...rects.map((r) => r.x + r.w));
  const bot = Math.max(...rects.map((r) => r.y + r.h));
  return { x: round3(x), y: round3(y), w: round3(rgt - x), h: round3(bot - y) };
}

function rectArea(r: Rect) {
  return Math.max(r.w, 0) * Math.max(r.h, 0);
}

/** Adjacent stalls (shared edge / tiny float gap). Street gaps and different parents do not count. */
export function rectsAbut(a: Rect, b: Rect, gap = 0.25) {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return overlapX >= -gap && overlapY >= -gap;
}

function connectedComponents(rects: Rect[]): Rect[][] {
  const n = rects.length;
  const seen = new Array(n).fill(false);
  const comps: Rect[][] = [];
  for (let i = 0; i < n; i += 1) {
    if (seen[i]) continue;
    const stack = [i];
    seen[i] = true;
    const comp: Rect[] = [];
    while (stack.length) {
      const k = stack.pop() as number;
      comp.push(rects[k]);
      for (let j = 0; j < n; j += 1) {
        if (!seen[j] && rectsAbut(rects[k], rects[j])) {
          seen[j] = true;
          stack.push(j);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

export function lotsConnected(rects: Rect[]) {
  if (rects.length <= 1) return true;
  const u = unionRects(rects);
  const s = rects.reduce((acc, r) => acc + rectArea(r), 0);
  if (!u || s <= 0) return false;
  if (connectedComponents(rects).length !== 1) return false;
  // Reject a street-sized hole inside an otherwise-adjacent group.
  return rectArea(u) <= 1.35 * s;
}

export type ClusterableLot = { parent: string; rect: Rect };

/**
 * Cluster by parent range first, then connected components within a parent.
 * Never union across a street / different parent. Each cluster is one tight union.
 */
export function clusterLotRects(lots: ClusterableLot[]): Rect[] {
  const byParent = new Map<string, Rect[]>();
  for (const lot of lots) {
    const list = byParent.get(lot.parent) || [];
    list.push(lot.rect);
    byParent.set(lot.parent, list);
  }
  const clusters: Rect[] = [];
  for (const rects of byParent.values()) {
    for (const comp of connectedComponents(rects)) {
      const u = unionRects(comp);
      if (u) clusters.push(u);
    }
  }
  return clusters;
}

export function focusRectForFootprint(lotRect: Rect, _parent: Rect | null | undefined): Rect {
  const padX = Math.max(5.5, lotRect.w * 9);
  const padY = Math.max(7, lotRect.h * 2.4);
  return {
    x: round3(lotRect.x - padX),
    y: round3(lotRect.y - padY),
    w: round3(lotRect.w + padX * 2),
    h: round3(lotRect.h + padY * 2),
  };
}
