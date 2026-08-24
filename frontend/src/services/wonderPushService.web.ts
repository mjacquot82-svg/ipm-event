const SDK_URL = 'https://cdn.by.wonderpush.com/sdk/1.1/wonderpush-loader.min.js';
const SDK_SCRIPT_ID = 'wonderpush-jssdk-loader';
const SERVICE_WORKER_PATH = '/webpushr-sw.js';
// Loading and routine state reads should fail quickly; first subscription gets
// longer because it may include permission, worker, push, and server setup.
const LOADER_TIMEOUT_MS = 10_000;
const READINESS_TIMEOUT_MS = 15_000;
const STATUS_TIMEOUT_MS = 10_000;
const SDK_SETTLE_TIMEOUT_MS = 3_000;
const SDK_SETTLE_RETRY_MS = 400;
const SDK_SETTLE_ATTEMPTS = 3;
const WORKER_READY_TIMEOUT_MS = 2_000;
const SESSION_READY_TIMEOUT_MS = 3_000;
const SUBSCRIBE_TIMEOUT_MS = 45_000;
const UNSUBSCRIBE_TIMEOUT_MS = 20_000;

type WonderPushQueue = unknown[] & {
  isSubscribedToNotifications?: () => Promise<boolean>;
  subscribeToNotifications?: () => Promise<unknown>;
  unsubscribeFromNotifications?: () => Promise<unknown>;
  getInstallationId?: () => Promise<string | null>;
  getSessionState?: () => unknown;
  SessionState?: { INIT_SUCCESS?: unknown };
};

type WonderPushReadSnapshot = {
  subscribed: boolean | null;
  installationId: string | null;
  subscriptionFailed: boolean;
  installationFailed: boolean;
};

declare global {
  interface Window {
    WonderPush?: WonderPushQueue;
  }
}

export type NotificationState =
  | 'loading'
  | 'default'
  | 'subscribed'
  | 'unsubscribed'
  | 'denied'
  | 'unsupported'
  | 'error';

let initialization: Promise<void> | null = null;
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function isSupported() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

function getWebKey() {
  return process.env.EXPO_PUBLIC_WONDERPUSH_WEB_KEY?.trim() || '';
}

export function getWonderPushWorkerUrl(webKey = getWebKey()) {
  return `${SERVICE_WORKER_PATH}?webKey=${encodeURIComponent(webKey)}`;
}

export function initializeWonderPush(): Promise<void> {
  if (initialization) return initialization;

  initialization = (async () => {
    if (!isSupported()) {
      throw new Error('Push notifications are not supported in this browser.');
    }

    const webKey = getWebKey();
    if (!webKey) {
      throw new Error('EXPO_PUBLIC_WONDERPUSH_WEB_KEY is not configured.');
    }

    window.WonderPush = window.WonderPush || [];
    window.WonderPush.push(['init', {
      webKey,
      serviceWorkerUrl: getWonderPushWorkerUrl(webKey),
    }]);

    const ready = new Promise<void>((resolve) => {
      window.WonderPush?.push(resolve);
    });

    const existingScript = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript?.dataset.loaded !== 'true') {
      const loader = new Promise<void>((resolve, reject) => {
        const script = existingScript || document.createElement('script');
        script.id = SDK_SCRIPT_ID;
        script.async = true;
        script.src = SDK_URL;
        script.onload = () => {
          script.dataset.loaded = 'true';
          resolve();
        };
        script.onerror = () => {
          script.remove?.();
          reject(new Error('WonderPush Website SDK failed to load.'));
        };
        if (!existingScript) document.head.appendChild(script);
      });
      await withTimeout(loader, LOADER_TIMEOUT_MS, 'WonderPush Website SDK loader timed out.');
    }

    await withTimeout(ready, READINESS_TIMEOUT_MS, 'WonderPush Website SDK readiness timed out.');
  })().catch((error) => {
    initialization = null;
    throw error;
  });

  return initialization;
}

async function withSdk<T>(
  operation: (sdk: WonderPushQueue) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  await initializeWonderPush();
  const sdk = window.WonderPush;
  if (!sdk) throw new Error('WonderPush Website SDK is unavailable.');
  return withTimeout(
    operation(sdk), timeoutMs, timeoutMessage
  );
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

async function waitForServiceWorkerReadiness() {
  const ready = navigator.serviceWorker?.ready;
  if (!ready) return;
  await withTimeout(Promise.resolve(ready).then(() => undefined), WORKER_READY_TIMEOUT_MS,
    'Service worker readiness timed out.').catch(() => undefined);
}

async function waitForWonderPushSessionReadiness(sdk: WonderPushQueue) {
  const readyState = sdk.SessionState?.INIT_SUCCESS;
  if (readyState === undefined || !sdk.getSessionState || typeof window.addEventListener !== 'function') return;
  if (sdk.getSessionState() === readyState) return;
  let listener: ((event: Event) => void) | null = null;
  const sessionReady = new Promise<void>((resolve) => {
    listener = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string; state?: unknown }>).detail;
      if (detail?.name === 'session' && detail.state === readyState) resolve();
    };
    window.addEventListener('WonderPushEvent', listener);
  });
  await withTimeout(sessionReady, SESSION_READY_TIMEOUT_MS, 'WonderPush session readiness timed out.')
    .catch(() => undefined);
  if (listener) window.removeEventListener('WonderPushEvent', listener);
}

export async function readWonderPushSnapshot({ attempts = SDK_SETTLE_ATTEMPTS,
  retryDelayMs = SDK_SETTLE_RETRY_MS, requireInstallation = true } = {}): Promise<WonderPushReadSnapshot> {
  await initializeWonderPush();
  await waitForServiceWorkerReadiness();
  if (window.WonderPush) await waitForWonderPushSessionReadiness(window.WonderPush);
  let snapshot: WonderPushReadSnapshot = { subscribed: null, installationId: null,
    subscriptionFailed: false, installationFailed: false };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    // Re-read the global after initialization so a loader-upgraded SDK object is never stale.
    const sdk = window.WonderPush;
    const [subscription, installation] = await Promise.allSettled([
      sdk?.isSubscribedToNotifications
        ? withTimeout(sdk.isSubscribedToNotifications(), SDK_SETTLE_TIMEOUT_MS, 'status timeout')
        : Promise.reject(new Error('subscription API unavailable')),
      sdk?.getInstallationId
        ? withTimeout(sdk.getInstallationId(), SDK_SETTLE_TIMEOUT_MS, 'installation timeout')
        : Promise.reject(new Error('installation API unavailable')),
    ]);
    snapshot = {
      subscribed: subscription.status === 'fulfilled' ? subscription.value : null,
      installationId: installation.status === 'fulfilled' ? installation.value : null,
      subscriptionFailed: subscription.status === 'rejected',
      installationFailed: installation.status === 'rejected',
    };
    if (snapshot.subscribed === true && (!requireInstallation || snapshot.installationId)) return snapshot;
    if (attempt + 1 < attempts) {
      if (retryDelayMs > 0) await wait(retryDelayMs);
      else await Promise.resolve();
    }
  }
  return snapshot;
}

export async function getNotificationState(): Promise<NotificationState> {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const subscribed = await withSdk(async (sdk) => {
      if (!sdk.isSubscribedToNotifications) throw new Error('WonderPush subscription API is unavailable.');
      return sdk.isSubscribedToNotifications();
    }, STATUS_TIMEOUT_MS, 'WonderPush notification status timed out.');
    if (subscribed && Notification.permission === 'granted') return 'subscribed';
    return Notification.permission === 'granted' ? 'unsubscribed' : 'default';
  } catch {
    return 'error';
  }
}

export async function subscribeToNotifications(): Promise<NotificationState> {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    await withSdk(async (sdk) => {
      if (!sdk.subscribeToNotifications) throw new Error('WonderPush subscribe API is unavailable.');
      await sdk.subscribeToNotifications();
    }, SUBSCRIBE_TIMEOUT_MS, 'WonderPush subscription timed out.');
    return getNotificationState();
  } catch {
    return (Notification.permission as NotificationPermission) === 'denied' ? 'denied' : 'error';
  }
}

export async function unsubscribeFromNotifications(): Promise<NotificationState> {
  if (!isSupported()) return 'unsupported';
  try {
    await withSdk(async (sdk) => {
      if (!sdk.unsubscribeFromNotifications) throw new Error('WonderPush unsubscribe API is unavailable.');
      await sdk.unsubscribeFromNotifications();
    }, UNSUBSCRIBE_TIMEOUT_MS, 'WonderPush unsubscribe timed out.');
    return getNotificationState();
  } catch {
    return 'error';
  }
}

export async function getSubscribedInstallationId(): Promise<string | null> {
  if (!isSupported() || Notification.permission !== 'granted') return null;
  const snapshot = await readWonderPushSnapshot();
  return snapshot.subscribed ? snapshot.installationId : null;
}

export type WonderPushDiagnostics = {
  browserPermission: 'granted' | 'denied' | 'default' | 'unavailable';
  sdk: 'ready' | 'unavailable';
  subscription: 'subscribed' | 'not-subscribed' | 'unavailable';
  installation: 'available' | 'unavailable';
  failureStage: string | null;
};

export type WonderPushClientReadiness = WonderPushDiagnostics & {
  supportedContext: boolean;
  clientReady: boolean;
};

export function evaluateWonderPushClientReadiness(
  diagnostic: WonderPushDiagnostics
): WonderPushClientReadiness {
  const supportedContext = diagnostic.browserPermission !== 'unavailable' && diagnostic.sdk === 'ready';
  return {
    ...diagnostic,
    supportedContext,
    clientReady: supportedContext
      && diagnostic.browserPermission === 'granted'
      && diagnostic.subscription === 'subscribed'
      && diagnostic.installation === 'available',
  };
}

export async function getWonderPushClientReadiness(): Promise<WonderPushClientReadiness> {
  return evaluateWonderPushClientReadiness(await getWonderPushDiagnostics());
}

export async function getWonderPushDiagnostics(): Promise<WonderPushDiagnostics> {
  const result: WonderPushDiagnostics = {
    browserPermission: typeof Notification === 'undefined' ? 'unavailable' : Notification.permission,
    sdk: 'unavailable', subscription: 'unavailable', installation: 'unavailable', failureStage: null,
  };
  let snapshot: WonderPushReadSnapshot;
  try { snapshot = await readWonderPushSnapshot(); result.sdk = 'ready'; }
  catch { result.failureStage = 'wonderpush_sdk_initialization'; return result; }
  result.subscription = snapshot.subscribed === null ? 'unavailable'
    : snapshot.subscribed ? 'subscribed' : 'not-subscribed';
  result.installation = snapshot.installationId ? 'available' : 'unavailable';
  if (snapshot.subscriptionFailed) result.failureStage = 'wonderpush_subscription_check';
  else if (!snapshot.subscribed) result.failureStage = 'wonderpush_subscription';
  else if (snapshot.installationFailed) result.failureStage = 'wonderpush_installation_lookup';
  else if (!snapshot.installationId) result.failureStage = 'wonderpush_installation_id';
  return result;
}
