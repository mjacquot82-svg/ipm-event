export function mapPaintViewport(measured: { width: number; height: number } | null, windowSize: { width: number; height: number }) {
  return measured || { width: Math.max(1, windowSize.width), height: Math.max(1, windowSize.height) };
}
export function mapLayerLayout(viewport: { width: number; height: number }) {
  const aspect = 2977 / 2105;
  const width = Math.min(viewport.width, viewport.height * aspect);
  return { width, height: width / aspect, left: (viewport.width - width) / 2, top: Math.max(0, (viewport.height - width / aspect) / 2) };
}
