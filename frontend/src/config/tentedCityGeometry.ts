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

export type TentedCityIndividualBooth = GeometryLot & {
  semanticId: string;
  humanLabel: string;
  parentRangeId: string;
  parentRangeLabel: string;
  section: string;
  boothNumber: number;
  orientation: string;
  orientationEvidence: string;
  orientationVerified: true;
};

/** Only high-confidence ordinary ranges expose individual selection. */
export const TENTED_CITY_SAFE_INDIVIDUAL_RANGES = TENTED_CITY_RANGE_AREAS.filter(
  (area) => !area.flagged && area.confidence === 'high'
    && area.split_axis === 'L_to_R' && area.orientation === 'horizontal',
);

/** Audited parent rectangles that must never mint individual blue stalls. */
export function isTrustedParentOnlyArea(area: GeometryArea | null | undefined): boolean {
  if (!area || !area.n_lots || area.flagged) return false;
  return !TENTED_CITY_SAFE_INDIVIDUAL_RANGES.some((candidate) => candidate.id === area.id);
}

export const TENTED_CITY_TRUSTED_PARENT_ONLY_RANGES = TENTED_CITY_RANGE_AREAS.filter(isTrustedParentOnlyArea);

const RANGE_TOKEN_RE = /^(\d+)([A-Za-z])[\s-]*(\d+)\s*[-–]\s*(\d+)$/;

/** Parse labels like 3A 39-44 / 3A-39-44 into an audited geometry range. */
export function parseRangeToken(token: string): GeometryArea | null {
  const t = (token || '').trim();
  if (!t) return null;
  const m = t.match(RANGE_TOKEN_RE) || t.replace(/\s+/g, ' ').match(RANGE_TOKEN_RE);
  if (!m) return null;
  const section = m[1] + m[2].toUpperCase();
  const start = Number(m[3]);
  const end = Number(m[4]);
  return TENTED_CITY_RANGE_AREAS.find(
    (area) => area.section === section && area.lot_start === start && area.lot_end === end,
  ) || null;
}

/** Inclusive booth span from a label like 3B-19-24 / 3B 19-24 (not necessarily a full parent area). */
export function parseInclusiveLotSpan(token: string): { section: string; start: number; end: number } | null {
  const t = (token || '').trim();
  if (!t) return null;
  const m = t.match(RANGE_TOKEN_RE) || t.replace(/\s+/g, ' ').match(RANGE_TOKEN_RE);
  if (!m) return null;
  const section = m[1] + m[2].toUpperCase();
  const a = Number(m[3]);
  const b = Number(m[4]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  if (start === end) return null; // single booth — use parseLotToken
  return { section, start, end };
}

export function individualBoothsForArea(area: GeometryArea): TentedCityIndividualBooth[] {
  if (!TENTED_CITY_SAFE_INDIVIDUAL_RANGES.some((candidate) => candidate.id === area.id)) return [];
  return lotsForArea(area).map((lot) => ({
    ...lot,
    semanticId: `booth-${lot.id.toLowerCase()}`,
    humanLabel: lot.id,
    parentRangeId: area.id,
    parentRangeLabel: area.label,
    section: area.section as string,
    boothNumber: lot.n,
    orientation: area.orientation as string,
    orientationEvidence: 'audited PDF-extracted rectangular range; consistent horizontal L-to-R split',
    orientationVerified: true as const,
  }));
}

export const TENTED_CITY_INDIVIDUAL_BOOTHS = TENTED_CITY_SAFE_INDIVIDUAL_RANGES.flatMap(individualBoothsForArea);
export const INDIVIDUAL_BOOTH_BY_ID = new Map(TENTED_CITY_INDIVIDUAL_BOOTHS.map((booth) => [booth.semanticId, booth]));
export const INDIVIDUAL_BOOTH_BY_LABEL = new Map(TENTED_CITY_INDIVIDUAL_BOOTHS.map((booth) => [booth.humanLabel, booth]));
const compactBoothKey = (value: string) => value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
export const INDIVIDUAL_BOOTH_BY_COMPACT = new Map(TENTED_CITY_INDIVIDUAL_BOOTHS.map((booth) => [compactBoothKey(booth.humanLabel), booth]));

export function findIndividualBooth(value: string) {
  const normalized = value.trim().replace(/^booth[-_]?/i, '');
  return INDIVIDUAL_BOOTH_BY_COMPACT.get(compactBoothKey(normalized)) || null;
}

export const LOT_BY_ID = new Map(TENTED_CITY_LOTS.map((lot) => [lot.id, lot]));
export const AREA_BY_ID = new Map(TENTED_CITY_AREAS.map((area) => [area.id, area]));

// PDF-audited MNP Lifestyles Tent / EAST-2 footprint (page 17 geometry areas).
export const MNP_LIFESTYLES_EAST2_AREA_ID = 'named-mnp-lifestyles-tent-east-2';
export const MNP_LIFESTYLES_EAST2_RECT: Rect = (() => {
  const area = AREA_BY_ID.get(MNP_LIFESTYLES_EAST2_AREA_ID);
  if (!area) throw new Error(`Missing geometry area ${MNP_LIFESTYLES_EAST2_AREA_ID}`);
  return area.rect;
})();

// Digitized tan Britespan campus on tented-city-map.png (Third Street S/W block
// + printed Ontario Mutuals Main Stage / Welcome Centre / Britespan building).
// Replaces the printed-label-strip-only named rect. Not 3B-28-32 / Hydro One Avenue.
export const BRITESPAN_BUILDING_AREA_ID = 'named-ontario-mutuals-main-stage-welcome-centre';
export const BRITESPAN_BUILDING_RECT: Rect = (() => {
  const area = AREA_BY_ID.get(BRITESPAN_BUILDING_AREA_ID);
  if (!area) throw new Error(`Missing geometry area ${BRITESPAN_BUILDING_AREA_ID}`);
  return area.rect;
})();

export const CKNX_WEST3_AREA_ID = 'named-cknx-centennial-pavilion-lounge-west-3';
export const CKNX_WEST3_RECT: Rect = (() => {
  const area = AREA_BY_ID.get(CKNX_WEST3_AREA_ID);
  if (!area) throw new Error(`Missing geometry area ${CKNX_WEST3_AREA_ID}`);
  return area.rect;
})();

export const HYDRO_ONE_EAST5_AREA_ID = 'named-east-5';
export const HYDRO_ONE_EAST5_RECT: Rect = (() => {
  const area = AREA_BY_ID.get(HYDRO_ONE_EAST5_AREA_ID);
  if (!area) throw new Error(`Missing geometry area ${HYDRO_ONE_EAST5_AREA_ID}`);
  return area.rect;
})();

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
  // Array.from so downlevel/test harnesses never iterate Map.values() as a fake array.
  for (const rects of Array.from(byParent.values())) {
    for (const comp of connectedComponents(rects)) {
      const u = unionRects(comp);
      if (u) clusters.push(u);
    }
  }
  return clusters;
}


/** Shared edges between adjacent trusted individual booth cells (L→R only). */
export type BoothDividerSegment = {
  key: string;
  parentRangeId: string;
  parentRangeLabel: string;
  /** Percent x of the shared vertical edge (left edge of the higher booth number). */
  x: number;
  y: number;
  h: number;
};

/** Divider lines for one safe individual range; empty for parent-only / unverified. */
export function boothDividerSegmentsForArea(area: GeometryArea): BoothDividerSegment[] {
  const booths = individualBoothsForArea(area);
  if (booths.length < 2) return [];
  const sorted = [...booths].sort((a, b) => a.boothNumber - b.boothNumber);
  const segments: BoothDividerSegment[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const left = sorted[i - 1];
    const right = sorted[i];
    segments.push({
      key: `div-${left.id}-${right.id}`,
      parentRangeId: right.parentRangeId,
      parentRangeLabel: right.parentRangeLabel,
      x: right.rect.x,
      y: right.rect.y,
      h: right.rect.h,
    });
  }
  return segments;
}

/** Precomputed overlay segments — only TENTED_CITY_SAFE_INDIVIDUAL_RANGES. */
export const TENTED_CITY_BOOTH_DIVIDER_SEGMENTS =
  TENTED_CITY_SAFE_INDIVIDUAL_RANGES.flatMap(boothDividerSegmentsForArea);

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
