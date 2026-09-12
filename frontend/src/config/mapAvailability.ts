import { tentedCityVendors } from '../data/tentedCityVendors';
import type { TentedCityPlace } from './tentedCityTypes';
import { placeRect } from './tentedCitySearch';
import { footprintForVendor } from './tentedCityVendorMatch';
import { resolveVendorMapQuery } from './vendorMapCrosswalk';

export const EXACT_MAP_UNAVAILABLE = "Exact map location isn't available yet.";

/** Use the current trusted resolver, never a raw/stale vendor rect or guessed parent. */
export function hasTrustedMapGeometry(place: TentedCityPlace): boolean {
  return place.kind === 'vendor'
    ? Boolean(footprintForVendor(place.vendor))
    : Boolean(placeRect(place));
}

export function vendorHasTrustedMapGeometry(name: string): boolean {
  const resolved = resolveVendorMapQuery(name);
  if (resolved.status !== 'mapped') return false;
  const vendor = tentedCityVendors.find((item) => item.name === resolved.query);
  return Boolean(vendor && hasTrustedMapGeometry({ kind: 'vendor', vendor }));
}
