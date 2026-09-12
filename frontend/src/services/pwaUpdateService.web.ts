/** Foreground-only release detection. Refresh is always an attendee decision. */
export const BACKGROUND_THRESHOLD_MS = 10 * 60 * 1000;
const GUARD_KEY = 'ipm:resume-update:last-attempt';
const DEADLINE_MS = 8000;
type Snapshot = { visible: boolean; refreshing: boolean };
let registration: ServiceWorkerRegistration | null = null;
let hiddenAt: number | null = null;
let safe = false;
let holds = 0;
let checking = false;
let target: string | null = null;
let dismissed: string | null = null;
let refreshing = false;
let activationRequested = false;
let attempt = 0;
let reloaded = false;
let generation = 0;
let lastAttempt: string | null = null;
let activationTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<(state: Snapshot) => void>();
const entryPattern = /\/_expo\/static\/js\/web\/entry-[a-zA-Z0-9_-]+\.js$/;
function currentEntry() {
  return Array.from(document.scripts).map(script => new URL(script.src, window.location.href).pathname)
    .find(path => entryPattern.test(path));
}
function available() {
  return !!registration && safe && holds === 0 && document.visibilityState === 'visible' && navigator.onLine !== false;
}
function emit() {
  const state = { visible: available() && !!target && target !== dismissed && target !== lastAttempt, refreshing };
  listeners.forEach(listener => listener(state));
}
async function releaseEntry(): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  try {
    const response = await fetch(`/app-release.json?resume=${Date.now()}`, {
      cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
    });
    if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('application/json')) return null;
    const value = await response.json();
    return typeof value.entry === 'string' && entryPattern.test(value.entry) ? value.entry : null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}
async function check() {
  if (checking || refreshing || !registration || navigator.onLine === false) return;
  const epoch = generation;
  checking = true;
  try {
    const entry = await releaseEntry();
    if (generation !== epoch || document.visibilityState !== 'visible') return;
    const current = currentEntry();
    if (entry && current) target = entry !== current && entry !== lastAttempt ? entry : null;
    emit();
  } finally { if (epoch === generation) checking = false; }
}
function visibilityChanged() {
  if (document.visibilityState === 'hidden') {
    if (hiddenAt === null) hiddenAt = Date.now();
    // Never turn a deferred controllerchange into a later surprise reload.
    cancelActivation();
  } else if (hiddenAt !== null) {
    const elapsed = Date.now() - hiddenAt;
    hiddenAt = null;
    if (elapsed >= BACKGROUND_THRESHOLD_MS) { dismissed = null; void check(); }
  }
  emit();
}
function cancelActivation() {
  clearTimeout(activationTimer);
  refreshing = false;
  activationRequested = false;
  attempt++;
}
function reloadOnce() {
  if (!refreshing || reloaded || !available() || !target) { cancelActivation(); emit(); return; }
  try {
    // Persist before navigation, including when currentLaunch falls back offline.
    sessionStorage.setItem(GUARD_KEY, target);
  } catch { cancelActivation(); emit(); return; } // Without a durable guard, leave the page alone.
  lastAttempt = target;
  reloaded = true;
  cancelActivation();
  window.location.reload();
}
function controllerChanged() { if (activationRequested) reloadOnce(); }
export async function activatePwaUpdate() {
  if (!available() || !target || refreshing || reloaded || target === lastAttempt) return;
  const epoch = generation;
  const requested = target;
  refreshing = true;
  const requestAttempt = attempt;
  emit();
  // Revalidate on the explicit tap; offline or a superseded deployment is a no-op.
  const entry = await releaseEntry();
  if (epoch !== generation || requestAttempt !== attempt || !refreshing) return;
  if (entry !== requested || !available()) { cancelActivation(); target = null; emit(); return; }
  try {
    await Promise.race([
      registration!.update(),
      new Promise((_, reject) => { activationTimer = setTimeout(() => reject(new Error('timeout')), DEADLINE_MS); }),
    ]);
    clearTimeout(activationTimer);
    const installing = registration?.installing;
    if (installing) await new Promise<void>((resolve, reject) => {
      const done = () => {
        if (installing.state !== 'installed' && installing.state !== 'redundant') return;
        clearTimeout(activationTimer); installing.removeEventListener('statechange', done); resolve();
      };
      activationTimer = setTimeout(() => { installing.removeEventListener('statechange', done); reject(new Error('timeout')); }, DEADLINE_MS);
      installing.addEventListener('statechange', done); done();
    });
    if (epoch !== generation || requestAttempt !== attempt || !refreshing || !available()) { cancelActivation(); emit(); return; }
    if (registration?.waiting && navigator.serviceWorker.controller) {
      activationTimer = setTimeout(() => { cancelActivation(); emit(); }, DEADLINE_MS);
      activationRequested = true;
      registration.waiting.postMessage({ type: 'IPM_ACTIVATE_UPDATE' });
    } else {
      // Existing currentLaunch fetches/validates the new shell even with the old worker.
      reloadOnce();
    }
  } catch { if (epoch === generation && requestAttempt === attempt) { cancelActivation(); emit(); } }
}
export function dismissPwaUpdate() { if (!refreshing) { dismissed = target; emit(); } }
export function subscribePwaUpdate(listener: (state: Snapshot) => void) {
  listeners.add(listener); emit(); return () => { listeners.delete(listener); };
}
export function setPwaUpdateSafeState(value: boolean) { safe = value; if (!value) cancelActivation(); emit(); }
export function holdPwaUpdate() {
  holds++; cancelActivation(); emit(); let released = false;
  return () => { if (!released) { released = true; holds--; emit(); } };
}
export function disposePwaUpdateFlow() {
  generation++; cancelActivation();
  document.removeEventListener('visibilitychange', visibilityChanged);
  navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
  registration = null; hiddenAt = null; checking = false; target = null; dismissed = null; reloaded = false;
}
export function startPwaUpdateFlow(next: ServiceWorkerRegistration) {
  disposePwaUpdateFlow(); registration = next;
  try { lastAttempt = sessionStorage.getItem(GUARD_KEY); } catch { lastAttempt = null; }
  hiddenAt = document.visibilityState === 'hidden' ? Date.now() : null;
  document.addEventListener('visibilitychange', visibilityChanged);
  navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
  return disposePwaUpdateFlow;
}
