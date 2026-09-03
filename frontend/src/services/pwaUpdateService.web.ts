export type PwaUpdateListener = (available: boolean) => void;

const ACTIVATE_UPDATE_MESSAGE = 'IPM_ACTIVATE_UPDATE';

let registration: ServiceWorkerRegistration | null = null;
let waitingWorker: ServiceWorker | null = null;
let installingWorker: ServiceWorker | null = null;
let updateCheck: Promise<void> | null = null;
let activationRequested = false;
let reloadStarted = false;
let started = false;
const listeners = new Set<PwaUpdateListener>();

function publish(available: boolean) {
  listeners.forEach((listener) => listener(available));
}

function detectWaitingWorker() {
  const candidate = registration?.waiting;
  // A worker installed without an existing controller is the first install,
  // not an application update that requires a reload.
  if (!candidate || !navigator.serviceWorker.controller) return;
  if (candidate === waitingWorker) return;
  waitingWorker = candidate;
  publish(true);
}

function observeInstallingWorker() {
  const candidate = registration?.installing;
  if (!candidate || candidate === installingWorker) return;
  installingWorker = candidate;
  candidate.addEventListener('statechange', () => {
    if (candidate.state === 'installed') detectWaitingWorker();
  });
}

function checkForUpdate() {
  if (!registration || navigator.onLine === false || updateCheck) return;
  updateCheck = registration.update()
    .then(() => {
      observeInstallingWorker();
      detectWaitingWorker();
    })
    .catch(() => undefined)
    .finally(() => {
      updateCheck = null;
    });
}

export function startPwaUpdateFlow(nextRegistration: ServiceWorkerRegistration) {
  registration = nextRegistration;
  observeInstallingWorker();
  detectWaitingWorker();
  if (started) return;
  started = true;

  nextRegistration.addEventListener('updatefound', observeInstallingWorker);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!activationRequested || reloadStarted) return;
    reloadStarted = true;
    window.location.reload();
  });
  window.addEventListener('online', checkForUpdate);
  window.addEventListener('focus', checkForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
}

export function subscribeToPwaUpdates(listener: PwaUpdateListener) {
  listeners.add(listener);
  listener(Boolean(waitingWorker));
  return () => listeners.delete(listener);
}

export function activatePwaUpdate() {
  if (!waitingWorker || activationRequested) return;
  activationRequested = true;
  waitingWorker.postMessage({ type: ACTIVATE_UPDATE_MESSAGE });
}
