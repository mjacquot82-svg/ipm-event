import type { TentedCityVendor } from '../config/tentedCityTypes';

type LocationUpdate = Pick<TentedCityVendor, 'locationLabel' | 'booths' | 'tent'> & Partial<Pick<TentedCityVendor, 'rect'>>;

const UPDATED_LOCATIONS: Record<string, LocationUpdate> = {
  // Sharon-confirmed assignments, September 19; existing identities are preserved.
  'Fellowship of Christian Farmers': { locationLabel: '2A-16–17', booths: ['2A-16', '2A-17'], tent: null, rect: null },
  'Mitchell Cycle Inc., Mitchell': { locationLabel: '2A-18–19', booths: ['2A-18', '2A-19'], tent: null, rect: null },
  'Bailey Repair Services Ltd., Palmerston': { locationLabel: '2A-20', booths: ['2A-20'], tent: null, rect: null },
  'Your Ultimate Structures Inc., Beachville': { locationLabel: '2A-09', booths: ['2A-09'], tent: null },
  'Eastern Silk Road, Kitchener': { locationLabel: '4B-04', booths: ['4B-04'], tent: null },
  'JW Custom Fab, Cargill': { locationLabel: '5A-21', booths: ['5A-21'], tent: null },
  'Weldesign Hardware Inc., Burgessville': { locationLabel: '2B-22', booths: ['2B-22'], tent: null },
  'Beef Farmers of Ontario & Bruce County Beef Farmer': {
    locationLabel: '2B-08–09',
    booths: ['2B-08', '2B-09'],
    tent: null,
  },
  'Hometown Street Eats, Drayton': {
    locationLabel: 'Lounge',
    booths: ['Lounge'],
    tent: null,
  },
};

export const CONSOLIDATED_ADDED_VENDORS: TentedCityVendor[] = [
  { name: 'B Town Farm Supply', category: '', tent: null, locationLabel: '1B-07', booths: ['1B-07'], rect: null },
  { name: 'National Energy Equipment Inc.', category: 'outdoor', tent: null, locationLabel: '2B-15', booths: ['2B-15'], rect: null },
  { name: 'Huron-Bruce Provincial Liberal Association', category: 'outdoor', tent: null, locationLabel: '3A-06', booths: ['3A-06'], rect: null },
  { name: 'CSN Auto Reset Group', category: 'outdoor', tent: null, locationLabel: '4B-02', booths: ['4B-02'], rect: null },
  { name: 'Maple Court Retirement', category: 'outdoor', tent: null, locationLabel: '4B-08', booths: ['4B-08'], rect: null },
];

export function applyConsolidatedExhibitorUpdates(vendors: TentedCityVendor[]): TentedCityVendor[] {
  const updated = vendors.filter((vendor) => vendor.name !== 'Weldesign Hardware Inc., Burgessville').map((vendor) => {
    const location = UPDATED_LOCATIONS[vendor.name];
    if (vendor.name === 'Beef Farmers of Ontario & Bruce County Beef Farmer') {
      return { ...vendor, name: 'Beef Farmers of Ontario & Bruce County Beef Farmers', ...location };
    }
    return location ? { ...vendor, ...location } : vendor;
  });
  const weldesign = vendors.find((vendor) => vendor.name === 'Weldesign Hardware Inc., Burgessville');
  if (weldesign) updated.push({ ...weldesign, ...UPDATED_LOCATIONS[weldesign.name] });
  return [...updated, ...CONSOLIDATED_ADDED_VENDORS.filter((vendor, index, all) => all.findIndex((item) => item.name === vendor.name) === index)];
}
