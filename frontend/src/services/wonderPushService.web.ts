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
  installationRequestObserved: boolean;
  installationRequestStatusClass: string | null;
  installationRequestDurationMs: number | null;
  responseStatusSupported: boolean;
  sessionRequestOutcome: 'load' | 'error' | 'timeout' | 'abort' | null;
  responseContainsToken: boolean;
  responseContainsInstallationId: boolean;
  sessionPersistenceSucceeded: boolean;
  sessionRequestErrorCode: string | null;
  errors: string[];
};

let initialization: Promise<void> | null = null;

type SessionObservation = Pick<WonderPushDiagnostics,
  | 'installationRequestObserved'
  | 'installationRequestStatusClass'
  | 'installationRequestDurationMs'
  | 'responseStatusSupported'
  | 'sessionRequestOutcome'
  | 'responseContainsToken'
  | 'responseContainsInstallationId'
  | 'sessionPersistenceSucceeded'
  | 'sessionRequestErrorCode'>;

const sessionObservation: SessionObservation = {
  installationRequestObserved: false,
  installationRequestStatusClass: null,
  installationRequestDurationMs: null,
  responseStatusSupported: typeof PerformanceResourceTiming !== 'undefined'
    && 'responseStatus' in PerformanceResourceTiming.prototype,
  sessionRequestOutcome: null,
  responseContainsToken: false,
  responseContainsInstallationId: false,
  sessionPersistenceSucceeded: false,
  sessionRequestErrorCode: null,
};

function statusClass(status: number): string {
  return status >= 200 && status < 300 ? '2xx'
    : status >= 400 && status < 500 ? '4xx'
      : status >= 500 && status < 600 ? '5xx' : 'unavailable';
}

function safeResponseError(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const error = record.error && typeof record.error === 'object'
    ? record.error as Record<string, unknown>
    : record;
  for (const candidate of [error.code, error.name]) {
    if ((typeof candidate === 'string' || typeof candidate === 'number')
      && /^[A-Za-z0-9_.-]{1,64}$/.test(String(candidate))) return String(candidate);
  }
  return null;
}

function checkSessionPersistence() {
  const check = () => {
    const sdk = window.WonderPush;
    if (!sdk?.getInstallationId) return;
    void Promise.resolve(sdk.getInstallationId()).then(
      (installationId) => { sessionObservation.sessionPersistenceSucceeded = Boolean(installationId); },
      () => undefined
    );
  };
  check();
  setTimeout(check, 250);
  setTimeout(check, 1500);
}

function installSessionRequestObserver() {
  if (process.env.EXPO_PUBLIC_EVENT_ID !== 'ipm-staging' || typeof XMLHttpRequest === 'undefined') return;
  const prototype = XMLHttpRequest.prototype as XMLHttpRequest & { __ipmSessionObserver?: boolean };
  if (prototype.__ipmSessionObserver) return;
  prototype.__ipmSessionObserver = true;
  const observed = new WeakSet<XMLHttpRequest>();
  const originalOpen = prototype.open;
  const originalSend = prototype.send;

  prototype.open = function (method: string, url: string | URL) {
    try {
      const parsed = new URL(String(url), window.location.origin);
      if (method.toUpperCase() === 'POST'
        && parsed.origin === 'https://api.wonderpush.com'
        && parsed.pathname === '/v1/authentication/accessToken') observed.add(this);
    } catch {
      // An invalid URL remains the SDK's responsibility.
    }
    return Reflect.apply(originalOpen, this, Array.from(arguments));
  } as typeof originalOpen;

  prototype.send = function () {
    if (observed.has(this)) {
      const started = performance.now();
      sessionObservation.installationRequestObserved = true;
      sessionObservation.sessionPersistenceSucceeded = false;
      let finished = false;
      const finish = (outcome: 'load' | 'error' | 'timeout' | 'abort') => {
        if (finished) return;
        finished = true;
        sessionObservation.sessionRequestOutcome = outcome;
        sessionObservation.responseStatusSupported = typeof this.status === 'number';
        sessionObservation.installationRequestDurationMs = Math.round(performance.now() - started);
        sessionObservation.installationRequestStatusClass = statusClass(this.status);
        if (outcome !== 'load') {
          sessionObservation.sessionRequestErrorCode = outcome === 'error'
            ? 'NetworkError' : outcome === 'timeout' ? 'TimeoutError' : 'AbortError';
          return;
        }
        try {
          const response = JSON.parse(this.responseText) as Record<string, unknown>;
          const data = response.data && typeof response.data === 'object'
            ? response.data as Record<string, unknown> : null;
          sessionObservation.responseContainsToken = typeof response.token === 'string' && response.token.length > 0;
          sessionObservation.responseContainsInstallationId = typeof data?.installationId === 'string'
            && data.installationId.length > 0;
          sessionObservation.sessionRequestErrorCode = safeResponseError(response);
          if (sessionObservation.responseContainsToken && sessionObservation.responseContainsInstallationId) {
            checkSessionPersistence();
          }
        } catch (error) {
          sessionObservation.sessionRequestErrorCode = error instanceof Error ? error.name : 'ParseError';
        }
      };
      this.addEventListener('load', () => finish('load'));
      this.addEventListener('error', () => finish('error'));
      this.addEventListener('timeout', () => finish('timeout'));
      this.addEventListener('abort', () => finish('abort'));
    }
    return Reflect.apply(originalSend, this, Array.from(arguments));
  } as typeof originalSend;
}

installSessionRequestObserver();

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
  const installationRequest = typeof performance !== 'undefined'
    ? performance.getEntriesByType('resource')
      .filter((entry) => entry.name.startsWith('https://api.wonderpush.com/v1/authentication/accessToken'))
      .at(-1) as (PerformanceResourceTiming & { responseStatus?: number }) | undefined
    : undefined;
  const responseStatus = installationRequest?.responseStatus;
  const diagnostics: WonderPushDiagnostics = {
    permission: isSupported() ? Notification.permission : 'unsupported',
    sdkSubscribed: null,
    installationId: null,
    workerScopePath: null,
    workerScriptPath: null,
    controllerPath: pathOnly(navigator.serviceWorker?.controller?.scriptURL),
    hasPushSubscription: null,
    installationRequestObserved: sessionObservation.installationRequestObserved || Boolean(installationRequest),
    installationRequestStatusClass: sessionObservation.installationRequestStatusClass || (responseStatus
      ? `${Math.floor(responseStatus / 100)}xx`
      : null),
    installationRequestDurationMs: sessionObservation.installationRequestDurationMs ?? (installationRequest
      ? Math.round(installationRequest.duration)
      : null),
    responseStatusSupported: sessionObservation.responseStatusSupported,
    sessionRequestOutcome: sessionObservation.sessionRequestOutcome,
    responseContainsToken: sessionObservation.responseContainsToken,
    responseContainsInstallationId: sessionObservation.responseContainsInstallationId,
    sessionPersistenceSucceeded: sessionObservation.sessionPersistenceSucceeded,
    sessionRequestErrorCode: sessionObservation.sessionRequestErrorCode,
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
