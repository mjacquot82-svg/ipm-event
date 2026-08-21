const SDK_URL = 'https://cdn.by.wonderpush.com/sdk/1.1/wonderpush-loader.min.js';
const SDK_SCRIPT_ID = 'wonderpush-jssdk';
const SERVICE_WORKER_PATH = '/webpushr-sw.js';

type WonderPushQueue = unknown[] & {
  isSubscribedToNotifications?: () => Promise<boolean>;
  subscribeToNotifications?: () => Promise<unknown>;
  unsubscribeFromNotifications?: () => Promise<unknown>;
  getInstallationId?: () => Promise<string | null>;
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

  initialization = new Promise((resolve, reject) => {
    if (!isSupported()) {
      reject(new Error('Push notifications are not supported in this browser.'));
      return;
    }

    const webKey = getWebKey();
    if (!webKey) {
      reject(new Error('EXPO_PUBLIC_WONDERPUSH_WEB_KEY is not configured.'));
      return;
    }

    window.WonderPush = window.WonderPush || [];
    window.WonderPush.push(['init', {
      webKey,
      serviceWorkerUrl: getWonderPushWorkerUrl(webKey),
    }]);

    const existingScript = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript?.dataset.loaded === 'true') {
      resolve();
      return;
    }

    const script = existingScript || document.createElement('script');
    script.id = SDK_SCRIPT_ID;
    script.async = true;
    script.src = SDK_URL;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('WonderPush Website SDK failed to load.'));
    if (!existingScript) document.head.appendChild(script);
  });

  return initialization;
}

async function withSdk<T>(operation: (sdk: WonderPushQueue) => Promise<T>): Promise<T> {
  await initializeWonderPush();
  return new Promise<T>((resolve, reject) => {
    const queue = window.WonderPush;
    if (!queue) {
      reject(new Error('WonderPush Website SDK is unavailable.'));
      return;
    }
    queue.push(() => {
      void operation(queue).then(resolve, reject);
    });
  });
}

export async function getNotificationState(): Promise<NotificationState> {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const subscribed = await withSdk(async (sdk) => {
      if (!sdk.isSubscribedToNotifications) throw new Error('WonderPush subscription API is unavailable.');
      return sdk.isSubscribedToNotifications();
    });
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
    });
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
    });
    return getNotificationState();
  } catch {
    return 'error';
  }
}

export async function getWonderPushInstallationId(): Promise<string | null> {
  return withSdk(async (sdk) => {
    if (!sdk.getInstallationId) return null;
    return sdk.getInstallationId();
  });
}
