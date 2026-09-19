import { groundsLayerLayout } from './groundsLayout';
import { GROUNDS_MAP } from './groundsZones';

// The title and orange decoration are printed in the original JPEG. The aerial
// artwork starts at source row 182. Clip only that header; keep full-image
// coordinates for the image, traffic, highlights and camera hit testing.
export const GROUNDS_HEADER_HEIGHT = 182;

export function groundsPhoneLayerLayout(viewport: { width: number; height: number }) {
  const visibleFraction = 1 - GROUNDS_HEADER_HEIGHT / GROUNDS_MAP.imageHeight;
  const layer = groundsLayerLayout({ width: viewport.width, height: viewport.height / visibleFraction });
  const headerHeight = layer.height * (1 - visibleFraction);
  return { ...layer, top: -headerHeight, headerHeight };
}
