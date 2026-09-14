import { resolveGroundsZone, resolvePlowingMapLocation } from '../config/groundsZones';
import { findTentedCityPlace, resolveMapTypeForLocation } from '../config/tentedCitySearch';
import { findSemanticAreaForLocation } from '../config/tentedCitySemanticMap';
import { hasTrustedMapGeometry, vendorHasTrustedMapGeometry } from '../config/mapAvailability';
import { resolveVendorMapQuery } from '../config/vendorMapCrosswalk';
import { tentedCityVendors } from '../data/tentedCityVendors';

// Eligibility only: the existing button handlers still own all routing.
export function scheduleMapTipEligible(location?: string | null, title = '') {
  if (!location?.trim()) return false;
  const query = resolvePlowingMapLocation(location, title) || location;
  if (resolveMapTypeForLocation(query, tentedCityVendors) === 'grounds') return Boolean(resolveGroundsZone(query));
  const place = findTentedCityPlace(query, tentedCityVendors);
  return place ? hasTrustedMapGeometry(place) : Boolean(findSemanticAreaForLocation(query));
}
export function vendorMapTipEligible(name: string, location?: string) {
  return resolveVendorMapQuery(name, location).status === 'mapped' && vendorHasTrustedMapGeometry(name);
}
