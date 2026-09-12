import { RV_PARK_MAP } from './rvParkGeometry';

export const RV_PARK_IMAGE_ASPECT = RV_PARK_MAP.imageWidth / RV_PARK_MAP.imageHeight;

/** Letterbox the official artwork into a viewport. Never returns 0. */
export function rvParkFittedSize(vw: number, vh: number) {
  const width = Math.max(vw, 1);
  const height = Math.max(vh, 1);
  const viewAspect = width / height;
  if (viewAspect > RV_PARK_IMAGE_ASPECT) {
    return { width: height * RV_PARK_IMAGE_ASPECT, height };
  }
  return { width, height: width / RV_PARK_IMAGE_ASPECT };
}

/**
 * First paint uses the window size so the map is not 0x0 while waiting for
 * onLayout (RN-web often skips the first onLayout on absolutely positioned views).
 */
export function rvParkPaintViewport(
  measured: { width: number; height: number } | null,
  windowSize: { width: number; height: number },
) {
  if (measured && measured.width > 1 && measured.height > 1) {
    return measured;
  }
  return {
    width: Math.max(windowSize.width, 1),
    height: Math.max(windowSize.height, 1),
  };
}

export function rvParkLayerLayout(viewport: { width: number; height: number }) {
  const mapSize = rvParkFittedSize(viewport.width, viewport.height);
  return {
    mapSize,
    width: mapSize.width,
    height: mapSize.height,
    left: (viewport.width - mapSize.width) / 2,
    top: (viewport.height - mapSize.height) / 2,
    renderable: mapSize.width > 0 && mapSize.height > 0,
  };
}
