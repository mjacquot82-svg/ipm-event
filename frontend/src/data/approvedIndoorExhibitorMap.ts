import approved from './approvedIndoorExhibitors.json';
import type { TentedCityVendor } from '../config/tentedCityTypes';

/** Sharon-confirmed containing areas only; these are not individual stalls. */
export function applyApprovedIndoorExhibitors(vendors: TentedCityVendor[]): TentedCityVendor[] {
  const names = new Set(approved.flatMap((entry) => [entry.name, ...entry.replacesMapNames]));
  return [
    ...vendors.filter((vendor) => !names.has(vendor.name)),
    ...approved.map((entry) => ({
      name: entry.name,
      category: 'indoor',
      tent: entry.location.replace(/^Indoors at (the )?/, ''),
      locationLabel: entry.area,
      booths: [entry.area],
      rect: null,
    })),
  ];
}
