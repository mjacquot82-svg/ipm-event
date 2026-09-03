import { GROUNDS_MAP } from './groundsZones';

export const GROUNDS_IMAGE_ASPECT = GROUNDS_MAP.imageWidth / GROUNDS_MAP.imageHeight;

/** Letterbox the official artwork into a viewport. Never returns 0. */
export function groundsFittedSize(vw: number, vh: number) {
  const width = Math.max(vw, 1);
  const height = Math.max(vh, 1);
  const viewAspect = width / height;
  if (viewAspect > GROUNDS_IMAGE_ASPECT) {
    return { width: height * GROUNDS_IMAGE_ASPECT, height };
  }
  return { width, height: width / GROUNDS_IMAGE_ASPECT };
}

/**
 * First paint uses the window size so the map is not 0x0 while waiting for
 * onLayout (RN-web often skips the first onLayout on absolutely positioned views).
 */
export function groundsPaintViewport(
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

export function groundsLayerLayout(viewport: { width: number; height: number }) {
  const mapSize = groundsFittedSize(viewport.width, viewport.height);
  return {
    mapSize,
    width: mapSize.width,
    height: mapSize.height,
    left: (viewport.width - mapSize.width) / 2,
    top: (viewport.height - mapSize.height) / 2,
    renderable: mapSize.width > 0 && mapSize.height > 0,
  };
}
