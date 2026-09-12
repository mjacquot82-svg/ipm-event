import type { Rect } from './tentedCityTypes';

/** Paint in the same untransformed layer as the cell; the camera transforms both. */
export function boothHighlightStyle(
  rect: Rect,
  layer: { width: number; height: number },
  requestedBorder: number,
  outset = 0,
) {
  const centerX = (rect.x + rect.w / 2) * layer.width / 100;
  const centerY = (rect.y + rect.h / 2) * layer.height / 100;
  const width = rect.w * layer.width / 100 + outset * 2;
  const height = rect.h * layer.height / 100 + outset * 2;
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
    // Fixed borders can impose a minimum box size larger than a narrow booth.
    // Leave room for the fill, including before the camera zooms the layer.
    borderWidth: Math.min(requestedBorder, width / 4, height / 4),
  };
}
