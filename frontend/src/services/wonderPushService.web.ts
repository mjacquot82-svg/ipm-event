const SDK_URL = 'https://cdn.by.wonderpush.com/sdk/1.1/wonderpush-loader.min.js';
const SDK_SCRIPT_ID = 'wonderpush-jssdk-loader';
const SERVICE_WORKER_PATH = '/webpushr-sw.js';
// Loading and routine state reads should fail quickly; first subscription gets
// longer because it may include permission, worker, push, and server setup.
const LOADER_TIMEOUT_MS = 10_000;
const READINESS_TIMEOUT_MS = 15_000;
const STATUS_TIMEOUT_MS = 10_000;
const SUBSCRIBE_TIMEOUT_MS = 45_000;
const UNSUBSCRIBE_TIMEOUT_MS = 20_000;

type WonderPushQueue = unknown[] & {
  isSubscribedToNotifications?: () => Promise<boolean>;
  subscribeToNotifications?: () => Promise<unknown>;
  unsubscribeFromNotifications?: () => Promise<unknown>;
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

export async function getNotificationState(): Promise<NotificationState> {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const subscribed = await withSdk(async (sdk) => {
      if (!sdk.isSubscribedToNotifications) throw new Error('WonderPush subscription API is unavailable.');
      return sdk.isSubscribedToNotifications();
    }, STATUS_TIMEOUT_MS, 'WonderPush notification status timed out.');
    if (subscribed) return 'subscribed';
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
