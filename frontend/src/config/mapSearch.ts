import { GROUNDS_ZONES, type GroundsZone, type GroundsZoneId } from './groundsZones';
import { findSemanticAreaForLocation, type SemanticMapArea } from './tentedCitySemanticMap';
import { searchTentedCity, tokensMatch, type MapTypeParam } from './tentedCitySearch';
import type { TentedCityPlace, TentedCityVendor } from './tentedCityTypes';

export type EventMapHit =
  | {
      key: string;
      title: string;
      subtitle: string;
      mapType: 'tented';
      kind: 'vendor';
      place: Extract<TentedCityPlace, { kind: 'vendor' }>;
    }
  | {
      key: string;
      title: string;
      subtitle: string;
      mapType: 'tented';
      kind: 'stage';
      place: Extract<TentedCityPlace, { kind: 'stage' }>;
    }
  | {
      key: string;
      title: string;
      subtitle: string;
      mapType: 'tented';
      kind: 'semantic';
      query: string;
      area: SemanticMapArea;
    }
  | {
      key: string;
      title: string;
      subtitle: string;
      mapType: 'grounds';
      kind: 'grounds';
      zoneId: GroundsZoneId;
      query: string;
      zone: GroundsZone;
    };

const GROUNDS_SEARCH: Array<{
  zoneId: GroundsZoneId;
  title: string;
  subtitle: string;
  aliases: string[];
}> = [
  { zoneId: 'rv-park', title: 'RV Park', subtitle: 'Grounds · camping', aliases: ['rv park', 'rv', 'camping', 'rv camping', 'campground'] },
  { zoneId: 'west-parking', title: 'West Parking Lot', subtitle: 'Grounds · parking', aliases: ['west parking', 'west parking lot', 'parking'] },
  { zoneId: 'north-parking', title: 'North Parking Lot', subtitle: 'Grounds · parking', aliases: ['north parking', 'north parking lot', 'parking'] },
  { zoneId: 'horse-plowing', title: 'Horse Plowing', subtitle: 'Grounds · plowing', aliases: ['horse plowing', 'plowing', 'plowing fields', 'plowing field'] },
  { zoneId: 'tractor-plowing', title: 'Tractor Plowing', subtitle: 'Grounds · plowing', aliases: ['tractor plowing', 'plowing', 'plowing fields', 'plowing field'] },
  { zoneId: 'bus-stop', title: 'Bus Stop', subtitle: 'Grounds · shuttle', aliases: ['bus stop', 'shuttle', 'shuttle stop', 'shuttle stops', 'shuttle pickup', 'shuttle dropoff'] },
  { zoneId: 'tented-city', title: 'Tented City', subtitle: 'Grounds footprint', aliases: ['tented city'] },
  { zoneId: 'accessible-parking', title: 'Accessible Parking (Grounds)', subtitle: 'Grounds · wheelchair icon', aliases: ['accessible parking', 'accessible', 'wheelchair'] },
];

const SEMANTIC_SEARCH: Array<{ title: string; subtitle: string; query: string; aliases: string[] }> = [
  {
    title: 'Event Centre #1 — West 2',
    subtitle: 'Tented City · WEST 2',
    query: 'Event Centre #1 — West 2',
    aliases: ['event centre', 'event center', 'west 2', 'west2', 'dancing tractors', 'combine derby'],
  },
  {
    title: 'Accessible Parking',
    subtitle: 'Tented City · north strip',
    query: 'Accessible Parking',
    aliases: ['accessible parking', 'accessible', 'wheelchair'],
  },
];

const BLOCKED_QUERIES = [
  'bus parking',
  'bus parking #1194',
  'bus parking 1194',
  '1194',
  'parade',
  'parade route',
];

function zoneById(id: GroundsZoneId): GroundsZone {
  const zone = GROUNDS_ZONES.find((item) => item.id === id);
  if (!zone) throw new Error('missing grounds zone ' + id);
  return zone;
}

export function isBlockedMapQuery(query: string) {
  const q = query.toLowerCase().replace(/[_#]+/g, ' ').replace(/\s+/g, ' ').trim();
  return BLOCKED_QUERIES.some((blocked) => q === blocked || q === blocked.replace('#', '').trim());
}

function aliasHits(alias: string, raw: string) {
  const q = raw.toLowerCase();
  if (alias === 'parking' && /\b(west|north)\b/.test(q)) return tokensMatch(alias, raw);
  if (alias === 'plowing' && /\b(horse|tractor)\b/.test(q)) return tokensMatch(alias, raw);
  if ((alias === 'accessible' || alias === 'wheelchair' || alias === 'accessible parking') && /\bgrounds\b/.test(q)) {
    return alias.includes('grounds') || tokensMatch('accessible parking (grounds)', raw);
  }
  return tokensMatch(alias, raw) || tokensMatch(raw, alias) || tokensMatch(raw, alias);
}

export function searchEventMap(
  query: string,
  vendors: TentedCityVendor[],
  filter: 'all' | 'food' | 'stages' | 'vendors' = 'all',
  limit = 40,
): EventMapHit[] {
  const raw = query.trim();
  if (!raw) return [];
  if (isBlockedMapQuery(raw)) return [];

  const hits: EventMapHit[] = [];
  const seen = new Set<string>();
  const push = (hit: EventMapHit) => {
    if (seen.has(hit.key)) return;
    seen.add(hit.key);
    hits.push(hit);
  };

  if (filter === 'all' || filter === 'stages' || filter === 'food' || filter === 'vendors') {
    for (const place of searchTentedCity(raw, vendors, filter, limit)) {
      if (place.kind === 'vendor') {
        push({
          key: `place:vendor:${place.vendor.name}`,
          title: place.vendor.name,
          subtitle: `Tented City · ${place.vendor.locationLabel}`,
          mapType: 'tented',
          kind: 'vendor',
          place,
        });
      } else {
        push({
          key: `place:stage:${place.venue.label}`,
          title: place.venue.label,
          subtitle: 'Tented City · stage',
          mapType: 'tented',
          kind: 'stage',
          place,
        });
      }
    }
  }

  if (filter === 'all' || filter === 'stages') {
    for (const row of SEMANTIC_SEARCH) {
      if (!row.aliases.some((alias) => aliasHits(alias, raw) || tokensMatch(row.title, raw))) continue;
      const area = findSemanticAreaForLocation(row.query);
      if (!area) continue;
      push({
        key: `semantic:${area.id}`,
        title: row.title,
        subtitle: row.subtitle,
        mapType: 'tented',
        kind: 'semantic',
        query: row.query,
        area,
      });
    }
  }

  if (filter === 'all') {
    for (const row of GROUNDS_SEARCH) {
      if (!row.aliases.some((alias) => aliasHits(alias, raw) || tokensMatch(row.title, raw))) continue;
      const zone = zoneById(row.zoneId);
      push({
        key: `grounds:${zone.id}`,
        title: row.title,
        subtitle: row.subtitle,
        mapType: 'grounds',
        kind: 'grounds',
        zoneId: zone.id,
        query: zone.label,
        zone,
      });
    }
  }

  return hits.slice(0, limit);
}

export function eventMapHitQuery(hit: EventMapHit): string {
  if (hit.kind === 'grounds' || hit.kind === 'semantic') return hit.query;
  return hit.kind === 'vendor' ? hit.place.vendor.name : hit.place.venue.label;
}

export function resolveHitMapType(hit: EventMapHit): MapTypeParam {
  return hit.mapType;
}

