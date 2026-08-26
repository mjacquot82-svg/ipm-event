import { getStartupTimings } from './startupPerformance';

export type OfflineShellStatus = {
  bundleIdentity: string;
  cachedShellVersions: string[];
  controllingShellVersion: string;
  updateWaiting: boolean;
  startupTimings: { name: string; milliseconds: number }[];
};

const CACHE_PREFIX = 'ipm-offline-shell-';

function getBundleIdentity() {
  const entry = performance.getEntriesByType('resource')
    .map((item) => item.name)
    .find((name) => /\/_expo\/static\/js\/web\/entry-[a-f0-9]+\.js(?:\?|$)/.test(name));
  return entry?.match(/entry-([a-f0-9]+)\.js/)?.[1] || 'unavailable';
}

async function getControllingShellVersion() {
  const controller = navigator.serviceWorker?.controller;
  if (!controller || typeof MessageChannel === 'undefined') return 'unavailable';
  return new Promise<string>((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve('unavailable'), 750);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data?.shellVersion || 'unavailable');
    };
    controller.postMessage({ type: 'IPM_GET_OFFLINE_STATUS' }, [channel.port2]);
  });
}

export async function getOfflineShellStatus(): Promise<OfflineShellStatus> {
  const [registration, cacheNames, controllingShellVersion] = await Promise.all([
    navigator.serviceWorker?.getRegistration('/'),
    typeof caches === 'undefined' ? [] : caches.keys(),
    getControllingShellVersion(),
  ]);
  return {
    bundleIdentity: getBundleIdentity(),
    cachedShellVersions: cacheNames
      .filter((name) => name.startsWith(CACHE_PREFIX))
      .map((name) => name.slice(CACHE_PREFIX.length)),
    controllingShellVersion,
    updateWaiting: Boolean(registration?.waiting),
    startupTimings: getStartupTimings(),
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
