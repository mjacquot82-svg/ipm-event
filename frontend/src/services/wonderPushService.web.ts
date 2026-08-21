const SDK_URL = 'https://cdn.by.wonderpush.com/sdk/1.1/wonderpush-loader.min.js';
const SDK_SCRIPT_ID = 'wonderpush-jssdk-loader';
const SERVICE_WORKER_PATH = '/webpushr-sw.js';
const SDK_TIMEOUT_MS = 9000;

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

export type WonderPushDiagnostics = {
  permission: NotificationPermission | 'unsupported';
  sdkSubscribed: boolean | null;
  installationId: string | null;
  workerScopePath: string | null;
  workerScriptPath: string | null;
  controllerPath: string | null;
  hasPushSubscription: boolean | null;
  errors: string[];
};

let initialization: Promise<void> | null = null;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), SDK_TIMEOUT_MS);
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
      await withTimeout(loader, 'WonderPush Website SDK loader timed out.');
    }

    await withTimeout(ready, 'WonderPush Website SDK readiness timed out.');
  })().catch((error) => {
    initialization = null;
    throw error;
  });

  return initialization;
}

async function withSdk<T>(operation: (sdk: WonderPushQueue) => Promise<T>): Promise<T> {
  await initializeWonderPush();
  const sdk = window.WonderPush;
  if (!sdk) throw new Error('WonderPush Website SDK is unavailable.');
  return withTimeout(
    operation(sdk),
    'WonderPush Website SDK operation timed out.'
  );
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

function pathOnly(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return null;
  }
}

function safeErrorCode(phase: string, error: unknown) {
  return `${phase}:${error instanceof Error ? error.name : 'UnknownError'}`;
}

export async function getWonderPushDiagnostics(): Promise<WonderPushDiagnostics> {
  const diagnostics: WonderPushDiagnostics = {
    permission: isSupported() ? Notification.permission : 'unsupported',
    sdkSubscribed: null,
    installationId: null,
    workerScopePath: null,
    workerScriptPath: null,
    controllerPath: pathOnly(navigator.serviceWorker?.controller?.scriptURL),
    hasPushSubscription: null,
    errors: [],
  };

  try {
    diagnostics.sdkSubscribed = await withSdk(async (sdk) => {
      if (!sdk.isSubscribedToNotifications) throw new Error('SubscriptionApiUnavailable');
      return sdk.isSubscribedToNotifications();
    });
  } catch (error) {
    diagnostics.errors.push(safeErrorCode('subscription-state', error));
  }

  try {
    diagnostics.installationId = await getWonderPushInstallationId();
  } catch (error) {
    diagnostics.errors.push(safeErrorCode('installation-id', error));
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const registration = registrations.find((candidate) => {
      const worker = candidate.active || candidate.waiting || candidate.installing;
      return pathOnly(worker?.scriptURL) === SERVICE_WORKER_PATH;
    });
    const worker = registration?.active || registration?.waiting || registration?.installing;
    diagnostics.workerScopePath = pathOnly(registration?.scope);
    diagnostics.workerScriptPath = pathOnly(worker?.scriptURL);
    diagnostics.hasPushSubscription = registration
      ? Boolean(await registration.pushManager.getSubscription())
      : false;
  } catch (error) {
    diagnostics.errors.push(safeErrorCode('service-worker', error));
  }

  return diagnostics;
}
