const ACTIVATE_UPDATE_MESSAGE = 'IPM_ACTIVATE_UPDATE';
const BACKGROUND_THRESHOLD_MS = 10 * 60 * 1000;
const MAX_DIAGNOSTICS = 24;
const ENTRY_FINGERPRINT_RE = /\/_expo\/static\/js\/web\/entry-[^"'?\s]+\.js/i;

export type PwaUpdateListener = (available: boolean) => void;

type PwaUpdateDiagnostic = { event: string; at: string };

let registration: ServiceWorkerRegistration | null = null;
let waitingWorker: ServiceWorker | null = null;
let installingWorker: ServiceWorker | null = null;
let installingStateListener: (() => void) | null = null;
let updateCheck: Promise<void> | null = null;
let activationRequested = false;
let reloadStarted = false;
let reloadPending = false;
let started = false;
let safeToShow = true;
let interactionHolds = 0;
let lastBackgroundedAt: number | null = null;
let promptAvailable = false;
let dismissedForFingerprint: string | null = null;
let lastPromptedFingerprint: string | null = null;
let successfulActivationFingerprint: string | null = null;
const listeners = new Set<PwaUpdateListener>();
const diagnostics: PwaUpdateDiagnostic[] = [];

function now() {
  return Date.now();
}

function recordDiagnostic(event: string) {
  diagnostics.push({ event, at: new Date().toISOString() });
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.splice(0, diagnostics.length - MAX_DIAGNOSTICS);
}

export function getPwaUpdateDiagnostics(): readonly PwaUpdateDiagnostic[] {
  return diagnostics.map((entry) => ({ ...entry }));
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__IPM_PWA_UPDATE_DIAGNOSTICS__', {
    configurable: true,
    value: getPwaUpdateDiagnostics,
  });
}

function publish(available: boolean) {
  promptAvailable = available;
  listeners.forEach((listener) => listener(available));
}

function canShowPrompt() {
  return started
    && safeToShow
    && interactionHolds === 0
    && !activationRequested
    && !reloadStarted;
}

function readLocalEntryFingerprint(): string | null {
  if (typeof document === 'undefined') return null;
  const scripts = document.getElementsByTagName('script');
  for (let index = 0; index < scripts.length; index += 1) {
    const src = scripts[index]?.getAttribute('src') || '';
    const match = src.match(ENTRY_FINGERPRINT_RE);
    if (match) return match[0];
  }
  return null;
}

function extractEntryFingerprint(html: string): string | null {
  return html.match(ENTRY_FINGERPRINT_RE)?.[0] ?? null;
}

async function fetchLiveEntryFingerprint(): Promise<string | null> {
  if (typeof fetch !== 'function') return null;
  const response = await fetch(`/?ipm_resume_update=${now()}`, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return null;
  return extractEntryFingerprint(await response.text());
}

function markUpdateAvailable(fingerprint: string | null, fromWaitingWorker = false) {
  if (!fromWaitingWorker && !fingerprint && !waitingWorker) return;
  // After a successful Refresh, ignore fingerprint matches for the page we just loaded.
  // A waiting worker always means a newer generation is ready for an explicit prompt.
  if (!fromWaitingWorker && fingerprint && fingerprint === successfulActivationFingerprint) return;
  if (fingerprint && fingerprint === dismissedForFingerprint) return;
  if (fingerprint && fingerprint === lastPromptedFingerprint && promptAvailable) return;
  if (fingerprint) lastPromptedFingerprint = fingerprint;
  recordDiagnostic('update_available');
  if (canShowPrompt()) publish(true);
  else recordDiagnostic('update_deferred_unsafe');
}

function detectWaitingWorker() {
  const candidate = registration?.waiting;
  // A worker installed without an existing controller is the first install,
  // not an application update that requires a reload.
  if (!candidate || !navigator.serviceWorker.controller) return;
  if (candidate === waitingWorker) return;
  waitingWorker = candidate;
  recordDiagnostic('worker_waiting');
  markUpdateAvailable(readLocalEntryFingerprint(), true);
}

function observeInstallingWorker() {
  const candidate = registration?.installing;
  if (!candidate || candidate === installingWorker) return;
  if (installingWorker && installingStateListener) {
    installingWorker.removeEventListener('statechange', installingStateListener);
  }
  installingWorker = candidate;
  recordDiagnostic('worker_installing');
  installingStateListener = () => {
    if (candidate.state === 'installed') detectWaitingWorker();
  };
  candidate.addEventListener('statechange', installingStateListener);
}

async function compareLiveFingerprint(): Promise<string | null> {
  const local = readLocalEntryFingerprint();
  const live = await fetchLiveEntryFingerprint();
  if (!local || !live) return null;
  if (local === live) return null;
  recordDiagnostic('fingerprint_newer');
  return live;
}

function runUpdateCheck() {
  if (!registration
    || navigator.onLine === false
    || document.visibilityState !== 'visible'
    || updateCheck
    || activationRequested
    || reloadStarted) return;

  recordDiagnostic('update_check_started');
  updateCheck = (async () => {
    let newerFingerprint: string | null = null;
    try {
      newerFingerprint = await compareLiveFingerprint();
    } catch {
      recordDiagnostic('fingerprint_check_failed');
    }

    try {
      await registration!.update();
      observeInstallingWorker();
      detectWaitingWorker();
    } catch {
      recordDiagnostic('sw_update_failed');
    }

    if (newerFingerprint) markUpdateAvailable(newerFingerprint);
    else if (!waitingWorker) recordDiagnostic('update_check_current');
  })()
    .catch(() => undefined)
    .finally(() => {
      recordDiagnostic('update_check_completed');
      updateCheck = null;
    });
}

function maybeResumeFromBackground() {
  if (document.visibilityState !== 'visible') return;
  const backgroundedAt = lastBackgroundedAt;
  lastBackgroundedAt = null;
  if (backgroundedAt == null) return;
  const elapsed = now() - backgroundedAt;
  if (elapsed < BACKGROUND_THRESHOLD_MS) {
    recordDiagnostic('resume_below_threshold');
    return;
  }
  recordDiagnostic('resume_threshold_met');
  // A new long background period clears a prior "Later" dismissal.
  dismissedForFingerprint = null;
  runUpdateCheck();
  if (waitingWorker && canShowPrompt()) publish(true);
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    lastBackgroundedAt = now();
    recordDiagnostic('backgrounded');
    return;
  }
  maybeResumeFromBackground();
}

function handleUpdateFound() {
  recordDiagnostic('update_found');
  observeInstallingWorker();
}

function reloadWhenIdle() {
  if (!reloadPending || reloadStarted || interactionHolds > 0) return;
  reloadStarted = true;
  recordDiagnostic('reload_started');
  window.location.reload();
}

function handleControllerChange() {
  recordDiagnostic('controller_changed');
  if (!activationRequested || reloadStarted) return;
  reloadPending = true;
  reloadWhenIdle();
}

function flushDeferredPrompt() {
  if (!promptAvailable && waitingWorker && canShowPrompt()) {
    publish(true);
  } else if (promptAvailable && canShowPrompt()) {
    publish(true);
  } else if (promptAvailable && !canShowPrompt()) {
    // Keep internal availability but hide until safe.
    listeners.forEach((listener) => listener(false));
  }
}

export function disposePwaUpdateFlow() {
  registration?.removeEventListener('updatefound', handleUpdateFound);
  navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  if (installingWorker && installingStateListener) {
    installingWorker.removeEventListener('statechange', installingStateListener);
  }
  registration = null;
  waitingWorker = null;
  installingWorker = null;
  installingStateListener = null;
  updateCheck = null;
  activationRequested = false;
  reloadStarted = false;
  reloadPending = false;
  started = false;
  lastBackgroundedAt = null;
  promptAvailable = false;
  dismissedForFingerprint = null;
  lastPromptedFingerprint = null;
  publish(false);
}

export function startPwaUpdateFlow(nextRegistration: ServiceWorkerRegistration) {
  registration = nextRegistration;
  if (started) {
    observeInstallingWorker();
    detectWaitingWorker();
    return disposePwaUpdateFlow;
  }
  started = true;
  successfulActivationFingerprint = readLocalEntryFingerprint();

  nextRegistration.addEventListener('updatefound', handleUpdateFound);
  navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  observeInstallingWorker();
  detectWaitingWorker();
  return disposePwaUpdateFlow;
}

export function setPwaUpdateSafeState(isSafe: boolean) {
  safeToShow = isSafe;
  flushDeferredPrompt();
}

/** Prevent an update prompt/reload from interrupting an explicit attendee action. */
export function holdPwaUpdate() {
  interactionHolds += 1;
  flushDeferredPrompt();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    interactionHolds -= 1;
    reloadWhenIdle();
    flushDeferredPrompt();
  };
}

export function subscribeToPwaUpdates(listener: PwaUpdateListener) {
  listeners.add(listener);
  listener(promptAvailable && canShowPrompt());
  return () => {
    listeners.delete(listener);
  };
}

export function dismissPwaUpdate() {
  dismissedForFingerprint = lastPromptedFingerprint || readLocalEntryFingerprint();
  recordDiagnostic('update_dismissed_later');
  publish(false);
}

export function activatePwaUpdate() {
  if (activationRequested || reloadStarted) return;
  activationRequested = true;
  publish(false);
  recordDiagnostic('activation_requested');

  const candidate = waitingWorker || registration?.waiting || null;
  if (candidate && navigator.serviceWorker.controller) {
    waitingWorker = candidate;
    candidate.postMessage({ type: ACTIVATE_UPDATE_MESSAGE });
    return;
  }

  // Fingerprint-only newer release: one reload lets currentLaunch take the cold path.
  reloadPending = true;
  reloadWhenIdle();
}

/** Test helper: inject a synthetic background timestamp. */
export function __setLastBackgroundedAtForTests(timestamp: number | null) {
  lastBackgroundedAt = timestamp;
}

export const __PWA_UPDATE_TEST_CONSTANTS__ = {
  ACTIVATE_UPDATE_MESSAGE,
  BACKGROUND_THRESHOLD_MS,
};
