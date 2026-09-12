/**
 * Grounds camera constants — intentionally mirror Tented City.
 * Do not retune Grounds in isolation; share tentedCityCamera / mapInteraction.
 */
export {
  MIN_SCALE as GROUNDS_MIN_SCALE,
  MAX_SCALE as GROUNDS_MAX_SCALE,
  DOUBLE_TAP_SCALE as GROUNDS_DOUBLE_TAP_SCALE,
} from './tentedCityCamera';

/** Same as TC fit (scale 1). No Grounds-only initial zoom. */
export const GROUNDS_INITIAL_SCALE = 1;
