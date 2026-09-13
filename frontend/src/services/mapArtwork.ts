/** Artwork only: never import map components, geometry, or gesture code here. */
export const MAP_ARTWORK = {
  grounds: require('../../assets/images/grounds-site-map.jpg'),
  tented: require('../../assets/images/tented-city-map-app-ready.svg'),
  rv: require('../../assets/images/rv-park-detail-map.png'),
};
export type MapArtworkKey = keyof typeof MAP_ARTWORK;
export const ARTWORK_ORDER: MapArtworkKey[] = ['grounds', 'tented', 'rv'];
const warmed = new Map<MapArtworkKey, { image: HTMLImageElement; promise: Promise<void> }>();
let scheduled = false;

// Expo web exports these requires as { uri, width, height }. Use the very same
// source for RN Image and preloading; no fetch/blob URL or separate cache.
export function artworkUrl(key: MapArtworkKey): string {
  const source = MAP_ARTWORK[key];
  return typeof source === 'string' ? source : source.uri;
}

export function preloadArtwork(key: MapArtworkKey): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const existing = warmed.get(key);
  if (existing) return existing.promise;
  const image = new window.Image();
  image.fetchPriority = 'low';
  const promise = new Promise<void>((resolve, reject) => {
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      if (error) { warmed.delete(key); reject(error); } else resolve();
    };
    const timeout = setTimeout(() => finish(new Error('Artwork preload timed out')), 12000);
    image.onerror = () => finish(new Error('Artwork unavailable'));
    image.onload = () => {
      // SVG decode can reject despite a usable loaded image. Do not block later maps.
      if (typeof image.decode === 'function') image.decode().then(() => finish(), () => finish());
      else finish();
    };
    image.src = artworkUrl(key);
  });
  // Retain at most three images for same-document resource/decode reuse. Browsers
  // may still evict decoded pixels under memory pressure; this is not offline storage.
  warmed.set(key, { image, promise });
  return promise;
}

export function prioritizeArtwork(key: MapArtworkKey) {
  const entry = warmed.get(key);
  if (entry) entry.image.fetchPriority = 'high';
}

/** Called only after Home's initial data calls settle. One sequential queue per document. */
export function scheduleMapArtworkPreload(): () => void {
  if (typeof window === 'undefined' || scheduled) return () => {};
  scheduled = true;
  let stopped = false;
  let index = 0;
  let timer: ReturnType<typeof setTimeout>;
  let idle: number | undefined;
  const canPreload = () => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (document.readyState !== 'complete' || document.visibilityState !== 'visible' || navigator.onLine === false) return false;
    if (connection?.saveData || /^(slow-)?2g$/.test(connection?.effectiveType || '')) return false;
    // Yield to recent foreground resource activity without maintaining a network framework.
    const recent = performance.getEntriesByType('resource').slice(-1)[0];
    return !recent || performance.now() - (recent.startTime + recent.duration) >= 1000;
  };
  const queue = (delay: number) => { timer = setTimeout(attempt, delay); };
  const attempt = () => {
    if (stopped || index >= ARTWORK_ORDER.length) return;
    if (!canPreload()) { queue(3000); return; }
    const run = () => {
      idle = undefined;
      if (stopped) return;
      if (!canPreload()) { queue(3000); return; }
      const key = ARTWORK_ORDER[index++];
      performance.mark?.(`ipm-map-preload-${key}-start`);
      void preloadArtwork(key).catch(() => {}).finally(() => {
        performance.mark?.(`ipm-map-preload-${key}-end`);
        if (!stopped) queue(1000);
      });
    };
    if ('requestIdleCallback' in window) idle = window.requestIdleCallback(run, { timeout: 2000 });
    else run(); // Already deferred by the bounded timer; no immediate startup fetch.
  };
  queue(3000);
  return () => {
    stopped = true;
    clearTimeout(timer);
    if (idle !== undefined) window.cancelIdleCallback?.(idle);
    scheduled = false;
  };
}
