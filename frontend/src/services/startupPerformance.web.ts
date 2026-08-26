export type StartupTiming = { name: string; milliseconds: number };

declare global {
  interface Window {
    __IPM_STARTUP_TIMINGS__?: Record<string, number>;
    __IPM_WORKER_STARTUP_DIAGNOSTIC__?: unknown;
  }
}

export function markStartupStage(name: string) {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return;
  const timings = window.__IPM_STARTUP_TIMINGS__ ||= {};
  if (timings[name] === undefined) timings[name] = performance.now();
}

export function getStartupTimings(): StartupTiming[] {
  if (typeof window === 'undefined') return [];
  const timings = { ...(window.__IPM_STARTUP_TIMINGS__ || {}) };
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const bundle = performance.getEntriesByType('resource')
    .find((entry) => /\/entry-[a-f0-9]+\.js(?:\?|$)/.test(entry.name)) as PerformanceResourceTiming | undefined;
  if (navigation) {
    timings.service_worker_started = navigation.workerStart;
    timings.navigation_response_started = navigation.responseStart;
    timings.cached_document_finished = navigation.responseEnd;
  }
  if (bundle) {
    timings.bundle_load_started = bundle.startTime;
    timings.bundle_load_finished = bundle.responseEnd;
  }
  return Object.entries(timings)
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
