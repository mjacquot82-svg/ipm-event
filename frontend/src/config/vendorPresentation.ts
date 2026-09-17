import type { Vendor } from '../services/spreadsheetDataService';

export type VendorLocationPresentation = {
  record: Vendor;
  displayLocation: string;
  mapLocation: string;
};

export type AttendeeVendorGroup = {
  key: string;
  name: string;
  locations: VendorLocationPresentation[];
};

/** Normalize the identity used to group explicitly confirmed multi-location exhibitors. */
export function normalizeVendorIdentity(name: string) {
  return name.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();
}

// This is an allow-list: same-name records remain separate unless the organizer
// has confirmed they are one exhibitor with multiple legitimate locations.
const MULTI_LOCATION_IDENTITIES = new Set([
  normalizeVendorIdentity('Beef Farmers of Ontario & Bruce County Beef Farmers'),
]);

function friendlyLocation(record: Vendor) {
  if (
    normalizeVendorIdentity(record.name) === normalizeVendorIdentity('Beef Farmers of Ontario & Bruce County Beef Farmers') &&
    record.type === 'Indoor' &&
    record.location === 'SOUTH-4'
  ) {
    return 'Hydro One Education Area';
  }
  return record.location;
}

export function groupVendorsForAttendees(records: Vendor[]): AttendeeVendorGroup[] {
  const grouped = new Map<string, Vendor[]>();
  for (const record of records) {
    const identity = normalizeVendorIdentity(record.name);
    const key = MULTI_LOCATION_IDENTITIES.has(identity) ? identity : record.id;
    const bucket = grouped.get(key) || [];
    bucket.push(record);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries()).map(([key, bucket]) => ({
    key,
    name: bucket[0].name,
    locations: bucket.map((record) => ({
      record,
      displayLocation: friendlyLocation(record),
      mapLocation: record.location,
    })),
  }));
}

export function vendorGroupMatchesSearch(group: AttendeeVendorGroup, query: string, matches: (record: Vendor, query: string) => boolean) {
  return group.locations.some(({ record }) => matches(record, query));
}
