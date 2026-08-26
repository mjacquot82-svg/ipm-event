export type StartupTiming = { name: string; milliseconds: number };

declare global {
  interface Window {
    __IPM_STARTUP_TIMINGS__?: Record<string, number>;
  }
}

export function markStartupStage(name: string) {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return;
  const timings = window.__IPM_STARTUP_TIMINGS__ ||= {};
  if (timings[name] === undefined) timings[name] = performance.now();
}

export function getStartupTimings(): StartupTiming[] {
  if (typeof window === 'undefined') return [];
  return Object.entries(window.__IPM_STARTUP_TIMINGS__ || {})
    .map(([name, milliseconds]) => ({ name, milliseconds: Math.round(milliseconds) }))
    .sort((left, right) => left.milliseconds - right.milliseconds);
}

export function runAfterFirstPaint(task: () => void) {
  if (typeof requestAnimationFrame !== 'function') {
    const timer = setTimeout(task, 0);
    return () => clearTimeout(timer);
  }
  let secondFrame = 0;
  const firstFrame = requestAnimationFrame(() => {
    secondFrame = requestAnimationFrame(task);
  });
  return () => {
    cancelAnimationFrame(firstFrame);
    if (secondFrame) cancelAnimationFrame(secondFrame);
  };
}

export function runOnlineAfterFirstPaint(task: () => void) {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    return runAfterFirstPaint(task);
  }
  markStartupStage('network_work_deferred_offline');
  const resume = () => runAfterFirstPaint(task);
  window.addEventListener('online', resume, { once: true });
  return () => window.removeEventListener('online', resume);
}
