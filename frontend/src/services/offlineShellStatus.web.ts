import { getStartupTimings } from './startupPerformance';

export type OfflineShellStatus = {
  bundleIdentity: string;
  cachedShellVersions: string[];
  controllingShellVersion: string;
  updateWaiting: boolean;
  startupTimings: { name: string; milliseconds: number }[];
  workerStartupDiagnostic: WorkerStartupDiagnostic | null;
};

export type WorkerStartupDiagnostic = {
  workerBootStarted?: number;
  wonderPushImportStarted?: number;
  wonderPushImportFinished?: number | null;
  lastNavigation?: {
    receivedAt: number;
    selectedAt: number;
    respondedAt: number;
    strategy: string;
    cacheHit: boolean;
  } | null;
};

const CACHE_PREFIX = 'ipm-offline-shell-';

function getBundleIdentity() {
  const entry = performance.getEntriesByType('resource')
    .map((item) => item.name)
    .find((name) => /\/_expo\/static\/js\/web\/entry-[a-f0-9]+\.js(?:\?|$)/.test(name));
  return entry?.match(/entry-([a-f0-9]+)\.js/)?.[1] || 'unavailable';
}

async function getControllingShellStatus() {
  const controller = navigator.serviceWorker?.controller;
  if (!controller || typeof MessageChannel === 'undefined') {
    return { shellVersion: 'unavailable', diagnostic: null };
  }
  return new Promise<{ shellVersion: string; diagnostic: WorkerStartupDiagnostic | null }>((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve({ shellVersion: 'unavailable', diagnostic: null }), 750);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve({
        shellVersion: event.data?.shellVersion || 'unavailable',
        diagnostic: event.data || null,
      });
    };
    controller.postMessage({ type: 'IPM_GET_OFFLINE_STATUS' }, [channel.port2]);
  });
}

export async function getOfflineShellStatus(): Promise<OfflineShellStatus> {
  const [registration, cacheNames, controlling] = await Promise.all([
    navigator.serviceWorker?.getRegistration('/'),
    typeof caches === 'undefined' ? [] : caches.keys(),
    getControllingShellStatus(),
  ]);
  return {
    bundleIdentity: getBundleIdentity(),
    cachedShellVersions: cacheNames
      .filter((name) => name.startsWith(CACHE_PREFIX))
      .map((name) => name.slice(CACHE_PREFIX.length)),
    controllingShellVersion: controlling.shellVersion,
    updateWaiting: Boolean(registration?.waiting),
    startupTimings: getStartupTimings(),
    workerStartupDiagnostic: controlling.diagnostic,
  };
}

export async function checkForOfflineShellUpdate() {
  const registration = await navigator.serviceWorker?.getRegistration('/');
  if (registration && navigator.onLine) {
    await registration.update();
    const installing = registration.installing;
    if (installing && installing.state !== 'installed' && installing.state !== 'redundant') {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 10_000);
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' || installing.state === 'redundant') {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }
  }
  return getOfflineShellStatus();
}

export async function applyWaitingOfflineShellUpdate() {
  const registration = await navigator.serviceWorker?.getRegistration('/');
  if (!registration?.waiting) return false;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  }, { once: true });
  registration.waiting.postMessage({ type: 'IPM_ACTIVATE_WAITING_UPDATE' });
  return true;
}
