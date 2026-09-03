const ACTIVATE_UPDATE_MESSAGE = 'IPM_ACTIVATE_UPDATE';
const UPDATE_CHECK_INTERVAL_MS = 45_000;
const MAX_DIAGNOSTICS = 24;

type PwaUpdateDiagnostic = { event: string; at: string };

let registration: ServiceWorkerRegistration | null = null;
let waitingWorker: ServiceWorker | null = null;
let installingWorker: ServiceWorker | null = null;
let installingStateListener: (() => void) | null = null;
let updateCheck: Promise<void> | null = null;
let updateTimer: ReturnType<typeof setInterval> | null = null;
let activationRequested = false;
let reloadStarted = false;
let started = false;
let safeToActivate = false;
const diagnostics: PwaUpdateDiagnostic[] = [];

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

function canRunForegroundHomeChecks() {
  return started
    && safeToActivate
    && !activationRequested
    && navigator.onLine !== false
    && document.visibilityState === 'visible';
}

function stopUpdateScheduler() {
  if (!updateTimer) return;
  clearInterval(updateTimer);
  updateTimer = null;
}

function syncUpdateScheduler() {
  if (!canRunForegroundHomeChecks()) {
    stopUpdateScheduler();
    return;
  }
  if (!updateTimer) updateTimer = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
}

function activateWaitingWorkerIfSafe() {
  if (!safeToActivate || !waitingWorker || activationRequested) return;
  activationRequested = true;
  stopUpdateScheduler();
  recordDiagnostic('activation_requested');
  waitingWorker.postMessage({ type: ACTIVATE_UPDATE_MESSAGE });
}

function detectWaitingWorker() {
  const candidate = registration?.waiting;
  // A worker installed without an existing controller is the first install,
  // not an application update that requires a reload.
  if (!candidate || !navigator.serviceWorker.controller) return;
  if (candidate === waitingWorker) return;
  waitingWorker = candidate;
  recordDiagnostic('worker_waiting');
  activateWaitingWorkerIfSafe();
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

function checkForUpdate() {
  if (!registration
    || navigator.onLine === false
    || document.visibilityState !== 'visible'
    || updateCheck) return;
  recordDiagnostic('update_check_started');
  updateCheck = registration.update()
    .then(() => {
      observeInstallingWorker();
      detectWaitingWorker();
    })
    .catch(() => undefined)
    .finally(() => {
      recordDiagnostic('update_check_completed');
      updateCheck = null;
    });
}

function resumeUpdateFlow() {
  activateWaitingWorkerIfSafe();
  checkForUpdate();
  syncUpdateScheduler();
}

function handleUpdateFound() {
  recordDiagnostic('update_found');
  observeInstallingWorker();
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') resumeUpdateFlow();
  else stopUpdateScheduler();
}

function handleOffline() {
  stopUpdateScheduler();
}

function handleControllerChange() {
  recordDiagnostic('controller_changed');
  if (!activationRequested || reloadStarted) return;
  reloadStarted = true;
  recordDiagnostic('reload_started');
  window.location.reload();
}

export function disposePwaUpdateFlow() {
  stopUpdateScheduler();
  registration?.removeEventListener('updatefound', handleUpdateFound);
  navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  window.removeEventListener('online', resumeUpdateFlow);
  window.removeEventListener('offline', handleOffline);
  window.removeEventListener('focus', resumeUpdateFlow);
  window.removeEventListener('pageshow', resumeUpdateFlow);
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
  started = false;
}

export function startPwaUpdateFlow(nextRegistration: ServiceWorkerRegistration) {
  registration = nextRegistration;
  if (started) {
    observeInstallingWorker();
    detectWaitingWorker();
    return disposePwaUpdateFlow;
  }
  started = true;

  nextRegistration.addEventListener('updatefound', handleUpdateFound);
  navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
  window.addEventListener('online', resumeUpdateFlow);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('focus', resumeUpdateFlow);
  window.addEventListener('pageshow', resumeUpdateFlow);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  observeInstallingWorker();
  detectWaitingWorker();
  checkForUpdate();
  syncUpdateScheduler();
  return disposePwaUpdateFlow;
}

export function setPwaUpdateSafeState(isSafe: boolean) {
  safeToActivate = isSafe;
  activateWaitingWorkerIfSafe();
  if (isSafe) checkForUpdate();
  syncUpdateScheduler();
}
