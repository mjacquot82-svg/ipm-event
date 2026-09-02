import type { Rect, TentedCityVendor } from './tentedCityTypes';
import {
  AREA_BY_ID,
  AREA_BY_LABEL,
  LOT_BY_ID,
  formatLotId,
  lotsConnected,
  unionRects,
} from './tentedCityGeometry';

export type MatchClass = 'confident_lot' | 'range_or_named' | 'ambiguous' | 'unmatched';

export type VendorMatch = {
  class: MatchClass;
  reason: string;
  rect: Rect | null;
  parentRect: Rect | null;
  lotIds: string[];
  areaId: string | null;
};

export type VendorFootprint = {
  class: 'confident_lot' | 'range_or_named';
  rect: Rect;
  parentRect: Rect | null;
  lotIds: string[];
  areaId: string | null;
};

const NAMED_ALIASES: Record<string, string> = {
  EAST1: 'named-east-1',
  'EAST-1': 'named-east-1',
  'EAST 1': 'named-east-1',
  EAST2: 'named-mnp-lifestyles-tent-east-2',
  'EAST-2': 'named-mnp-lifestyles-tent-east-2',
  'EAST 2': 'named-mnp-lifestyles-tent-east-2',
  EAST5: 'named-east-5',
  'EAST-5': 'named-east-5',
  'EAST 5': 'named-east-5',
  WEST1: 'named-equipment-demo-area-west-1',
  'WEST-1': 'named-equipment-demo-area-west-1',
  'WEST 1': 'named-equipment-demo-area-west-1',
  WEST2: 'named-dancing-tractors-combine-derby-west-2',
  'WEST-2': 'named-dancing-tractors-combine-derby-west-2',
  'WEST 2': 'named-dancing-tractors-combine-derby-west-2',
  WEST3: 'named-cknx-centennial-pavilion-lounge-west-3',
  'WEST-3': 'named-cknx-centennial-pavilion-lounge-west-3',
  'WEST 3': 'named-cknx-centennial-pavilion-lounge-west-3',
  WEST4: 'named-can-am-demo-area-west-4',
  'WEST-4': 'named-can-am-demo-area-west-4',
  'WEST 4': 'named-can-am-demo-area-west-4',
  SOUTH1: 'named-ram-truck-corral-south-1',
  'SOUTH-1': 'named-ram-truck-corral-south-1',
  'SOUTH 1': 'named-ram-truck-corral-south-1',
  SOUTH2: 'named-antiques-historical-area-south-2-3',
  'SOUTH-2': 'named-antiques-historical-area-south-2-3',
  'SOUTH 2': 'named-antiques-historical-area-south-2-3',
  SOUTH3: 'named-antiques-historical-area-south-2-3',
  'SOUTH-3': 'named-antiques-historical-area-south-2-3',
  'SOUTH 3': 'named-antiques-historical-area-south-2-3',
  SOUTH23: 'named-antiques-historical-area-south-2-3',
  'SOUTH-2-3': 'named-antiques-historical-area-south-2-3',
  'SOUTH-2&3': 'named-antiques-historical-area-south-2-3',
  SOUTH4: 'named-hydro-one-education-centre-corn-maze-south-4',
  'SOUTH-4': 'named-hydro-one-education-centre-corn-maze-south-4',
  'SOUTH 4': 'named-hydro-one-education-centre-corn-maze-south-4',
  MUTUALSQUARE: 'named-mutual-square',
  'MUTUAL SQUARE': 'named-mutual-square',
  MAINSTAGE: 'named-ontario-mutuals-main-stage-welcome-centre',
  'MAIN STAGE': 'named-ontario-mutuals-main-stage-welcome-centre',
  WELCOMECENTRE: 'named-ontario-mutuals-main-stage-welcome-centre',
  'WELCOME CENTRE': 'named-ontario-mutuals-main-stage-welcome-centre',
  ACCESSIBLEPARKING: 'named-accessible-parking',
  'ACCESSIBLE PARKING': 'named-accessible-parking',
  QUILTTENT: 'range-3A-39-44',
  'QUILT TENT': 'range-3A-39-44',
  RURALEXPOCOURTYARD: 'range-3B-39-44',
  'RURAL EXPO COURTYARD': 'range-3B-39-44',
  RAMTRUCKCORRAL: 'named-ram-truck-corral-south-1',
  'RAM TRUCK CORRAL': 'named-ram-truck-corral-south-1',
  '3B-07-12': 'named-bruce-power-nuclear-energy-group',
  '3B 07-12': 'named-bruce-power-nuclear-energy-group',
  '3B0712': 'named-bruce-power-nuclear-energy-group',
  BRUCEPOWERTENT: 'named-bruce-power-nuclear-energy-group',
  'BRUCE-POWER-TENT': 'named-bruce-power-nuclear-energy-group',
  EQUIPMENTDEMO: 'named-equipment-demo-area-west-1',
  'EQUIPMENT DEMO': 'named-equipment-demo-area-west-1',
  'EQUIPMENT DEMO AREA': 'named-equipment-demo-area-west-1',
};

const LOT_RE = /^(\d+)([A-Za-z])[\s-]*(\d+)$/;

function compactKey(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

export function namedIdFor(token: string): string | null {
  const t = (token || '').trim();
  if (!t) return null;
  const keys = [t, t.toUpperCase(), t.trim().toUpperCase().replace(/\s+/g, ' '), compactKey(t)];
  for (const key of keys) {
    if (NAMED_ALIASES[key]) return NAMED_ALIASES[key];
  }
  return null;
}

/** Normalize 1A-09 / 1A 09 / 1A-9 / 1A09. */
export function parseLotToken(token: string): { id: string; section: string; n: number } | null {
  const t = (token || '').trim();
  if (!t) return null;
  const m = t.match(LOT_RE) || t.replace(/\s+/g, '').match(LOT_RE);
  if (m) {
    const section = m[1] + m[2].toUpperCase();
    const n = Number(m[3]);
    return { id: formatLotId(section, n), section, n };
  }
  const glued = t.replace(/[-\s]/g, '').match(/^(\d+)([A-Za-z])(\d+)$/);
  if (!glued) return null;
  const section = glued[1] + glued[2].toUpperCase();
  const n = Number(glued[3]);
  return { id: formatLotId(section, n), section, n };
}

function is5AMissing(section: string, n: number) {
  return section === '5A' && n >= 1 && n <= 4;
}

function is6BLot(section: string, n: number) {
  return section === '6B' && n >= 26 && n <= 29;
}

function isMutualPhantom(section: string, n: number) {
  return (section === '3A' || section === '3B') && n >= 25 && n <= 38;
}

/** Official map: 3B 7-12 slot is the Bruce Power & Nuclear Energy Group tent, not lots. */
function isBrucePowerSlot(section: string, n: number) {
  return section === '3B' && n >= 7 && n <= 12;
}

export function vendorTokens(vendor: Pick<TentedCityVendor, 'booths' | 'locationLabel'>): string[] {
  const booths = vendor.booths || [];
  if (booths.length) return booths;
  const label = (vendor.locationLabel || '').trim();
  if (!label) return [];
  return label.split(/[,/]+/).map((t) => t.trim()).filter(Boolean);
}

export function matchVendor(vendor: Pick<TentedCityVendor, 'booths' | 'locationLabel' | 'name'>): VendorMatch {
  const tokens = vendorTokens(vendor);
  if (!tokens.length) {
    return { class: 'unmatched', reason: 'no-tokens', rect: null, parentRect: null, lotIds: [], areaId: null };
  }

  const namedIds: string[] = [];
  const lots: { id: string; parent: string; rect: Rect }[] = [];
  const missing5a: string[] = [];
  const flagged6b: string[] = [];
  const mutual: string[] = [];
  const brucePower: string[] = [];
  const unknown: string[] = [];

  for (const tok of tokens) {
    const nid = namedIdFor(tok);
    if (nid) {
      namedIds.push(nid);
      continue;
    }
    const parsed = parseLotToken(tok);
    if (!parsed) {
      unknown.push(tok);
      continue;
    }
    if (is5AMissing(parsed.section, parsed.n)) {
      missing5a.push(parsed.id);
      continue;
    }
    if (isBrucePowerSlot(parsed.section, parsed.n)) {
      brucePower.push(parsed.id);
      continue;
    }
    if (is6BLot(parsed.section, parsed.n)) {
      flagged6b.push(parsed.id);
      continue;
    }
    if (isMutualPhantom(parsed.section, parsed.n)) {
      mutual.push(parsed.id);
      continue;
    }
    const lot = LOT_BY_ID.get(parsed.id);
    if (lot) lots.push(lot);
    else unknown.push(parsed.id);
  }

  if (unknown.length) {
    return {
      class: 'unmatched',
      reason: `unknown-token:${unknown.join(',')}`,
      rect: null,
      parentRect: null,
      lotIds: [],
      areaId: null,
    };
  }

  const kinds =
    (namedIds.length ? 1 : 0) +
    (lots.length ? 1 : 0) +
    (missing5a.length ? 1 : 0) +
    (flagged6b.length ? 1 : 0) +
    (mutual.length ? 1 : 0) +
    (brucePower.length ? 1 : 0);
  if (kinds > 1) {
    return { class: 'ambiguous', reason: 'mixed-token-kinds', rect: null, parentRect: null, lotIds: [], areaId: null };
  }

  if (missing5a.length) {
    return { class: 'ambiguous', reason: '5A-01-04-do-not-exist', rect: null, parentRect: null, lotIds: missing5a, areaId: null };
  }

  if (flagged6b.length) {
    const unique = [...new Set(flagged6b)].sort();
    if (unique.join() === '6B-26,6B-27,6B-28,6B-29') {
      const parent = AREA_BY_LABEL.get('6B 26-29');
      return {
        class: 'range_or_named',
        reason: '6B-26-29-whole-parent-only',
        rect: parent?.rect || null,
        parentRect: parent?.rect || null,
        lotIds: unique,
        areaId: parent?.id || 'range-6B-26-29',
      };
    }
    return {
      class: 'ambiguous',
      reason: '6B-26-29-numbering-unproven',
      rect: null,
      parentRect: null,
      lotIds: unique,
      areaId: null,
    };
  }

  if (namedIds.length) {
    const uniq = [...new Set(namedIds)];
    if (uniq.length !== 1) {
      return { class: 'ambiguous', reason: 'multiple-named-areas', rect: null, parentRect: null, lotIds: [], areaId: null };
    }
    const area = AREA_BY_ID.get(uniq[0]);
    if (!area) {
      return { class: 'unmatched', reason: 'named-missing', rect: null, parentRect: null, lotIds: [], areaId: uniq[0] };
    }
    return {
      class: 'range_or_named',
      reason: 'named-area',
      rect: area.rect,
      parentRect: area.rect,
      lotIds: [],
      areaId: area.id,
    };
  }

  if (brucePower.length) {
    const area = AREA_BY_ID.get('named-bruce-power-nuclear-energy-group');
    return {
      class: 'range_or_named',
      reason: '3B-07-12-bruce-power-named-tent',
      rect: area?.rect || null,
      parentRect: area?.rect || null,
      lotIds: [...new Set(brucePower)].sort(),
      areaId: 'named-bruce-power-nuclear-energy-group',
    };
  }

  if (mutual.length) {
    const area = AREA_BY_ID.get('named-mutual-square');
    return {
      class: 'range_or_named',
      reason: '3A/3B-25-38-mutual-square',
      rect: area?.rect || null,
      parentRect: area?.rect || null,
      lotIds: mutual,
      areaId: 'named-mutual-square',
    };
  }

  if (lots.length) {
    const rects = lots.map((l) => l.rect);
    if (!lotsConnected(rects)) {
      return {
        class: 'ambiguous',
        reason: 'disconnected-lots',
        rect: null,
        parentRect: null,
        lotIds: lots.map((l) => l.id),
        areaId: null,
      };
    }
    const rect = unionRects(rects);
    const parents = [...new Set(lots.map((l) => l.parent))];
    const parent = parents.length === 1 ? AREA_BY_LABEL.get(parents[0]) : undefined;
    return {
      class: 'confident_lot',
      reason: 'lots',
      rect,
      parentRect: parent?.rect || rect,
      lotIds: lots.map((l) => l.id),
      areaId: parent?.id || null,
    };
  }

  return { class: 'unmatched', reason: 'no-geometry', rect: null, parentRect: null, lotIds: [], areaId: null };
}

export function footprintForVendor(vendor: Pick<TentedCityVendor, 'booths' | 'locationLabel' | 'name'>): VendorFootprint | null {
  const match = matchVendor(vendor);
  if (match.class !== 'confident_lot' && match.class !== 'range_or_named') return null;
  if (!match.rect) return null;
  return {
    class: match.class,
    rect: match.rect,
    parentRect: match.parentRect,
    lotIds: match.lotIds,
    areaId: match.areaId,
  };
}

export function matchAllVendors(vendors: TentedCityVendor[]) {
  const classes: Record<MatchClass, string[]> = {
    confident_lot: [],
    range_or_named: [],
    ambiguous: [],
    unmatched: [],
  };
  const results = vendors.map((vendor) => {
    const match = matchVendor(vendor);
    classes[match.class].push(vendor.name);
    return { name: vendor.name, locationLabel: vendor.locationLabel, ...match };
  });
  return {
    vendor_count: vendors.length,
    totals: {
      confident_lot: classes.confident_lot.length,
      range_or_named: classes.range_or_named.length,
      ambiguous: classes.ambiguous.length,
      unmatched: classes.unmatched.length,
    },
    classes,
    results,
  };
}
