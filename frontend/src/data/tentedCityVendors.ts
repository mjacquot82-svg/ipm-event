import type { TentedCityVendor } from '../config/tentedCityTypes';
import { tentedCityVendorsPart1 } from './tentedCityVendorsPart1';
import { tentedCityVendorsPart2 } from './tentedCityVendorsPart2';
import { tentedCityVendorsPart3 } from './tentedCityVendorsPart3';
import { applySept16YellowUpdates } from './tentedCityVendorsSept16';

const productionVendors: TentedCityVendor[] = [
  ...tentedCityVendorsPart1,
  ...tentedCityVendorsPart2,
  ...tentedCityVendorsPart3,
];

export const tentedCityVendors: TentedCityVendor[] = applySept16YellowUpdates(productionVendors);

export default tentedCityVendors;
