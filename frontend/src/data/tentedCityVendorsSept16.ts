import type { TentedCityVendor } from '../config/tentedCityTypes';

type LocationUpdate = Pick<TentedCityVendor, 'locationLabel' | 'booths'>;

const UPDATED_LOCATIONS: Record<string, LocationUpdate> = {
  'Your Ultimate Structures Inc., Beachville': { locationLabel: '2A-09', booths: ['2A-09'] },
  'Eastern Silk Road, Kitchener': { locationLabel: '4B-04', booths: ['4B-04'] },
  'JW Custom Fab, Cargill': { locationLabel: '5A-21', booths: ['5A-21'] },
  'Weldesign Hardware Inc., Burgessville': { locationLabel: '2B-22', booths: ['2B-22'] },
};

export const SEPT16_ADDED_VENDORS: TentedCityVendor[] = [
  { name: 'National Energy Equipment Inc.', category: 'outdoor', tent: null, locationLabel: '2B-15', booths: ['2B-15'], rect: null },
  { name: 'Huron-Bruce Provincial Liberal Association', category: 'outdoor', tent: null, locationLabel: '3A-06', booths: ['3A-06'], rect: null },
  { name: 'CSN Auto Reset Group', category: 'outdoor', tent: null, locationLabel: '4B-02', booths: ['4B-02'], rect: null },
  { name: 'Maple Court Retirement', category: 'outdoor', tent: null, locationLabel: '4B-08', booths: ['4B-08'], rect: null },
];

export function applySept16YellowUpdates(vendors: TentedCityVendor[]): TentedCityVendor[] {
  const updated = vendors
    .filter((vendor) => vendor.name !== 'Weldesign Hardware Inc., Burgessville')
    .map((vendor) => {
      const location = UPDATED_LOCATIONS[vendor.name];
      return location ? { ...vendor, ...location } : vendor;
    });

  const weldesign = vendors.find((vendor) => vendor.name === 'Weldesign Hardware Inc., Burgessville');
  if (weldesign) {
    updated.push({ ...weldesign, ...UPDATED_LOCATIONS[weldesign.name] });
  }
  return [...updated, ...SEPT16_ADDED_VENDORS];
}
