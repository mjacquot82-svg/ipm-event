import { startWonderPushRuntimeObservation } from './wonderPushRuntimeDiagnostic';

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
const INSTALLATION_RECOVERY_ATTEMPTS = 12;
const INSTALLATION_RECOVERY_RETRY_MS = 750;
const LEGACY_SUBSCRIPTION_REPLACED_KEY = '@ipm_wonderpush_legacy_subscription_replaced_v1';
const WORKER_READY_TIMEOUT_MS = 2_000;
const SESSION_READY_TIMEOUT_MS = 3_000;
const SESSION_RECOVERY_TIMEOUT_MS = 45_000;
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
  sessionInitSuccess: boolean | null;
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
let offlineShellRegistration: Promise<ServiceWorkerRegistration> | null = null;
let offlineShellOnlineListenerInstalled = false;
let legacySubscriptionReplacementAttempted = false;
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

function safeSubscribeRejectionStage(error: unknown): WonderPushInstallationFailureStage {
  const name = error instanceof Error ? error.name : '';
  if (name.endsWith('.RegistrationInProgressError')) {
    return 'wonderpush_recovery_subscribe_registration_in_progress';
  }
  if (name.endsWith('.PermissionError') || name === 'NotAllowedError') {
    return 'wonderpush_recovery_subscribe_permission_rejected';
  }
  if (name.endsWith('.PushNotificationsNotSupportedError') || name === 'NotSupportedError') {
    return 'wonderpush_recovery_subscribe_push_not_supported';
  }
  if (name.endsWith('.SubscriptionStateError')) {
    return 'wonderpush_recovery_subscribe_subscription_state_rejected';
  }
  if (name.endsWith('.InternalWrongDomainError') || name.endsWith('.InternalWrongTargetError')) {
    return 'wonderpush_recovery_subscribe_wrong_context';
  }
  if (name.endsWith('.InternalStorageError')) {
    return 'wonderpush_recovery_subscribe_storage_failed';
  }
  if (name === 'InvalidStateError') return 'wonderpush_recovery_subscribe_dom_invalid_state';
  if (name === 'AbortError') return 'wonderpush_recovery_subscribe_dom_abort';
  if (name === 'NetworkError') return 'wonderpush_recovery_subscribe_dom_network';
  if (name.startsWith('WonderPushSDK.Errors.')) {
    return 'wonderpush_recovery_subscribe_provider_rejected';
  }
  return 'wonderpush_recovery_subscribe_unknown_rejection';
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

export function initializeOfflineShell(): Promise<ServiceWorkerRegistration> {
  if (offlineShellRegistration) return offlineShellRegistration;
  offlineShellRegistration = (async () => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.register) {
      throw new Error('Service workers are not supported in this browser.');
    }
    const webKey = getWebKey();
    if (!webKey) throw new Error('EXPO_PUBLIC_WONDERPUSH_WEB_KEY is not configured.');
    const registration = await navigator.serviceWorker.register(getWonderPushWorkerUrl(webKey), {
      scope: '/',
      updateViaCache: 'none',
    });
    if (!offlineShellOnlineListenerInstalled && typeof window?.addEventListener === 'function') {
      offlineShellOnlineListenerInstalled = true;
      window.addEventListener('online', () => {
        void navigator.serviceWorker.getRegistration('/').then((current) => current?.update()).catch(() => undefined);
      });
    }
    if (navigator.onLine) void registration.update().catch(() => undefined);
    return registration;
  })().catch((error) => {
    offlineShellRegistration = null;
    throw error;
  });
  return offlineShellRegistration;
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
    startWonderPushRuntimeObservation();
    window.WonderPush.push(['init', {
      webKey,
      serviceWorkerUrl: getWonderPushWorkerUrl(webKey),
    }]);

    const ready = new Promise<void>((resolve) => {
      window.WonderPush?.push(resolve);
    });

    await initializeOfflineShell();

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

export async function waitForWonderPushSessionReady(): Promise<void> {
  await initializeWonderPush();
  const sdk = window.WonderPush;
  const readyState = sdk?.SessionState?.INIT_SUCCESS;
  if (readyState === undefined || !sdk?.getSessionState || typeof window.addEventListener !== 'function') {
    throw new Error('WonderPush session readiness is unavailable.');
  }
  if (sdk.getSessionState() === readyState) return;

  let listener: ((event: Event) => void) | null = null;
  const sessionReady = new Promise<void>((resolve) => {
    listener = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string; state?: unknown }>).detail;
      if (detail?.name === 'session' && detail.state === readyState) resolve();
    };
    window.addEventListener('WonderPushEvent', listener);
    // Close the race between the first state read and listener installation.
    if (sdk.getSessionState?.() === readyState) resolve();
  });
  try {
    await withTimeout(sessionReady, SESSION_RECOVERY_TIMEOUT_MS,
      'WonderPush session recovery timed out.');
  } finally {
    if (listener) window.removeEventListener('WonderPushEvent', listener);
  }
}

function legacySubscriptionWasReplaced() {
  if (legacySubscriptionReplacementAttempted) return true;
  try {
    return window.localStorage?.getItem(LEGACY_SUBSCRIPTION_REPLACED_KEY) === 'true';
  } catch {
    return false;
  }
}

function rememberLegacySubscriptionReplacement() {
  legacySubscriptionReplacementAttempted = true;
  try {
    window.localStorage?.setItem(LEGACY_SUBSCRIPTION_REPLACED_KEY, 'true');
  } catch {
    // The in-memory guard still prevents repeated replacement in this session.
  }
}

async function replaceOrphanedPushSubscription(): Promise<boolean> {
  if (legacySubscriptionWasReplaced()) return false;
  const registration = await withTimeout(
    Promise.resolve(navigator.serviceWorker.ready),
    WORKER_READY_TIMEOUT_MS,
    'Current service worker registration was unavailable.'
  );
  const subscription = await withTimeout(
    registration.pushManager.getSubscription(),
    STATUS_TIMEOUT_MS,
    'Current push subscription lookup timed out.'
  );
  if (!subscription) return false;
  const removed = await withTimeout(
    subscription.unsubscribe(),
    UNSUBSCRIBE_TIMEOUT_MS,
    'Legacy push subscription replacement timed out.'
  );
  if (!removed) throw new Error('Legacy push subscription could not be removed.');
  rememberLegacySubscriptionReplacement();
  return true;
}

async function currentPushSubscriptionState(): Promise<'present' | 'absent' | 'unavailable'> {
  try {
    const registration = await withTimeout(
      Promise.resolve(navigator.serviceWorker.ready),
      WORKER_READY_TIMEOUT_MS,
      'Current service worker registration was unavailable.'
    );
    const subscription = await withTimeout(
      registration.pushManager.getSubscription(),
      STATUS_TIMEOUT_MS,
      'Current push subscription lookup timed out.'
    );
    return subscription ? 'present' : 'absent';
  } catch {
    return 'unavailable';
  }
}

function unavailableAfterCompletedReplacement(
  subscriptionState: 'present' | 'absent' | 'unavailable'
): WonderPushInstallationFailureStage {
  if (subscriptionState === 'present') {
    return 'legacy_replacement_completed_subscription_present_installation_unavailable';
  }
  if (subscriptionState === 'absent') {
    return 'legacy_replacement_completed_subscription_absent_installation_unavailable';
  }
  return 'legacy_replacement_completed_subscription_state_unavailable_installation_unavailable';
}

function registrationInProgressUnavailableStage(
  snapshot: WonderPushReadSnapshot,
  subscriptionState: 'present' | 'absent' | 'unavailable'
): WonderPushInstallationFailureStage {
  if (snapshot.installationFailed) {
    return 'wonderpush_registration_in_progress_installation_lookup_rejected';
  }
  if (subscriptionState === 'unavailable') {
    return 'wonderpush_registration_in_progress_service_worker_or_push_state_unavailable';
  }
  if (subscriptionState === 'absent') {
    return 'wonderpush_registration_in_progress_push_subscription_absent';
  }
  if (snapshot.subscriptionFailed || snapshot.subscribed === null) {
    return 'wonderpush_registration_in_progress_subscribed_state_unavailable';
  }
  if (snapshot.subscribed === false) {
    return 'wonderpush_registration_in_progress_wonderpush_not_subscribed';
  }
  if (snapshot.sessionInitSuccess === null) {
    return 'wonderpush_registration_in_progress_session_state_unavailable';
  }
  if (snapshot.sessionInitSuccess === false) {
    return 'wonderpush_registration_in_progress_session_not_ready';
  }
  return 'wonderpush_registration_in_progress_session_ready_push_present_subscribed_installation_null';
}

export async function readWonderPushSnapshot({ attempts = SDK_SETTLE_ATTEMPTS,
  retryDelayMs = SDK_SETTLE_RETRY_MS, requireInstallation = true } = {}): Promise<WonderPushReadSnapshot> {
  await initializeWonderPush();
  await waitForServiceWorkerReadiness();
  if (window.WonderPush) await waitForWonderPushSessionReadiness(window.WonderPush);
  let snapshot: WonderPushReadSnapshot = { subscribed: null, installationId: null,
    sessionInitSuccess: null, subscriptionFailed: false, installationFailed: false };
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
      sessionInitSuccess: sdk?.getSessionState && sdk.SessionState?.INIT_SUCCESS !== undefined
        ? sdk.getSessionState() === sdk.SessionState.INIT_SUCCESS : null,
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
  let snapshot: WonderPushReadSnapshot;
  try {
    snapshot = await readWonderPushSnapshot();
  } catch {
    throw new WonderPushInstallationRecoveryError('sdk_unavailable');
  }
  if (snapshot.subscribed && snapshot.installationId) return snapshot.installationId;

  // A Webpushr-era browser can retain granted browser permission while having
  // no current WonderPush installation or stable WonderPush subscription
  // snapshot. Reassert once, then allow the documented asynchronous session
  // creation a bounded settle window. The clean path returns above unchanged.
  let registrationAlreadyInProgress = false;
  try {
    await withSdk(async (sdk) => {
      if (!sdk.subscribeToNotifications) {
        throw new Error('WonderPush subscribe API is unavailable.');
      }
      await sdk.subscribeToNotifications();
    }, SUBSCRIBE_TIMEOUT_MS, 'WonderPush installation recovery timed out.');
  } catch (error) {
    const timedOut = error instanceof Error
      && error.message === 'WonderPush installation recovery timed out.';
    const rejectionStage = timedOut
      ? 'wonderpush_recovery_subscribe_timed_out'
      : safeSubscribeRejectionStage(error);
    if (rejectionStage === 'wonderpush_recovery_subscribe_registration_in_progress') {
      // WonderPush is already performing the supported registration pipeline.
      // Do not race it with another subscribe or unsubscribe operation; observe
      // the documented session/installation state through the bounded snapshot
      // window below.
      registrationAlreadyInProgress = true;
    } else {
      throw new WonderPushInstallationRecoveryError(rejectionStage);
    }
  }
  try {
    snapshot = await readWonderPushSnapshot({
      attempts: INSTALLATION_RECOVERY_ATTEMPTS,
      retryDelayMs: INSTALLATION_RECOVERY_RETRY_MS,
    });
  } catch {
    throw new WonderPushInstallationRecoveryError('wonderpush_recovery_snapshot_failed');
  }
  if (snapshot.subscribed && snapshot.installationId) return snapshot.installationId;
  if (registrationAlreadyInProgress) {
    throw new WonderPushInstallationRecoveryError(
      registrationInProgressUnavailableStage(snapshot, await currentPushSubscriptionState())
    );
  }

  // A completed replacement marker is only written after unsubscribe() returns
  // true. Normal SDK recovery above still runs on every later attempt/lifecycle.
  // A legacy browser subscription made the SDK cache SUBSCRIBED before IPM
  // removed that subscription directly. The SDK then treats later subscribe
  // calls as successful no-ops. Move through its documented unsubscribe and
  // subscribe operations so WonderPush owns the state transition and executes
  // its push-token/installation association pipeline. SDK unsubscribe preserves
  // browser permission and healthy installations return above unchanged.
  if (legacySubscriptionWasReplaced()) {
    const subscriptionState = await currentPushSubscriptionState();
    if (subscriptionState === 'present' && snapshot.subscribed === true) {
      try {
        await withSdk(async (sdk) => {
          if (!sdk.unsubscribeFromNotifications) {
            throw new Error('WonderPush unsubscribe recovery API is unavailable.');
          }
          await sdk.unsubscribeFromNotifications();
        }, UNSUBSCRIBE_TIMEOUT_MS, 'WonderPush association unsubscribe timed out.');
      } catch (error) {
        const timedOut = error instanceof Error
          && error.message === 'WonderPush association unsubscribe timed out.';
        throw new WonderPushInstallationRecoveryError(timedOut
          ? 'wonderpush_association_unsubscribe_timed_out'
          : 'wonderpush_association_unsubscribe_rejected');
      }
      let subscribedAfterUnsubscribe: boolean;
      try {
        subscribedAfterUnsubscribe = await withSdk(async (sdk) => {
          if (!sdk.isSubscribedToNotifications) {
            throw new Error('WonderPush subscription status API is unavailable.');
          }
          return sdk.isSubscribedToNotifications();
        }, STATUS_TIMEOUT_MS, 'WonderPush post-unsubscribe status timed out.');
      } catch {
        throw new WonderPushInstallationRecoveryError(
          'wonderpush_association_unsubscribe_state_unavailable'
        );
      }
      if (subscribedAfterUnsubscribe) {
        throw new WonderPushInstallationRecoveryError(
          'wonderpush_association_unsubscribe_state_still_subscribed'
        );
      }
      try {
        await withSdk(async (sdk) => {
          if (!sdk.subscribeToNotifications) {
            throw new Error('WonderPush subscribe recovery API is unavailable.');
          }
          await sdk.subscribeToNotifications();
        }, SUBSCRIBE_TIMEOUT_MS, 'WonderPush association subscribe timed out.');
      } catch (error) {
        const timedOut = error instanceof Error
          && error.message === 'WonderPush association subscribe timed out.';
        throw new WonderPushInstallationRecoveryError(timedOut
          ? 'wonderpush_association_subscribe_timed_out'
          : 'wonderpush_association_subscribe_rejected');
      }
      try {
        snapshot = await readWonderPushSnapshot({
          attempts: INSTALLATION_RECOVERY_ATTEMPTS,
          retryDelayMs: INSTALLATION_RECOVERY_RETRY_MS,
        });
      } catch {
        throw new WonderPushInstallationRecoveryError('wonderpush_association_snapshot_failed');
      }
      if (snapshot.subscribed && snapshot.installationId) return snapshot.installationId;
      if (snapshot.subscribed === true) {
        throw new WonderPushInstallationRecoveryError(snapshot.sessionInitSuccess
          ? 'legacy_association_recovery_subscribed_session_ready_installation_unavailable'
          : 'legacy_association_recovery_subscribed_session_not_ready_installation_unavailable');
      }
      throw new WonderPushInstallationRecoveryError(snapshot.subscribed === false
        ? 'legacy_association_recovery_not_subscribed_installation_unavailable'
        : 'legacy_association_recovery_subscription_state_unavailable');
    }
    throw new WonderPushInstallationRecoveryError(
      unavailableAfterCompletedReplacement(subscriptionState)
    );
  }

  // Push subscriptions are scoped to a service-worker registration and retain
  // their original application-server key. A root-scope Webpushr subscription
  // can therefore survive the worker-script cutover but cannot become a
  // WonderPush installation. Only after the normal SDK recovery has exhausted,
  // and only when the active registration proves that an orphaned subscription
  // exists, replace that single PushSubscription. Browser permission, the
  // worker registration, caches, IndexedDB, favorites and itinerary are untouched.
  let replaced = false;
  try {
    replaced = await replaceOrphanedPushSubscription();
  } catch {
    throw new WonderPushInstallationRecoveryError('legacy_subscription_replacement_failed');
  }
  if (!replaced) {
    throw new WonderPushInstallationRecoveryError('legacy_push_subscription_absent');
  }
  if (Notification.permission !== 'granted') {
    throw new WonderPushInstallationRecoveryError('wonderpush_session_initialization_failed');
  }
  try {
    await withSdk(async (sdk) => {
      if (!sdk.subscribeToNotifications) {
        throw new Error('WonderPush subscribe API is unavailable.');
      }
      await sdk.subscribeToNotifications();
    }, SUBSCRIBE_TIMEOUT_MS, 'WonderPush migration subscription timed out.');
  } catch (error) {
    const timedOut = error instanceof Error
      && error.message === 'WonderPush migration subscription timed out.';
    throw new WonderPushInstallationRecoveryError(timedOut
      ? 'legacy_unsubscribe_succeeded_wonderpush_resubscribe_timed_out'
      : 'legacy_unsubscribe_succeeded_wonderpush_resubscribe_rejected');
  }
  try {
    snapshot = await readWonderPushSnapshot({
      attempts: INSTALLATION_RECOVERY_ATTEMPTS,
      retryDelayMs: INSTALLATION_RECOVERY_RETRY_MS,
    });
  } catch {
    throw new WonderPushInstallationRecoveryError(
      'legacy_unsubscribe_succeeded_wonderpush_resubscribe_resolved_recovery_check_failed'
    );
  }
  if (snapshot.subscribed && snapshot.installationId) return snapshot.installationId;
  throw new WonderPushInstallationRecoveryError(
    unavailableAfterCompletedReplacement(await currentPushSubscriptionState())
  );
}

export type WonderPushInstallationFailureStage =
  | 'sdk_unavailable' | 'installation_still_unavailable'
  | 'wonderpush_recovery_subscribe_timed_out'
  | 'wonderpush_recovery_snapshot_failed'
  | 'wonderpush_recovery_subscribe_registration_in_progress'
  | 'wonderpush_registration_in_progress_installation_lookup_rejected'
  | 'wonderpush_registration_in_progress_service_worker_or_push_state_unavailable'
  | 'wonderpush_registration_in_progress_push_subscription_absent'
  | 'wonderpush_registration_in_progress_subscribed_state_unavailable'
  | 'wonderpush_registration_in_progress_wonderpush_not_subscribed'
  | 'wonderpush_registration_in_progress_session_state_unavailable'
  | 'wonderpush_registration_in_progress_session_not_ready'
  | 'wonderpush_registration_in_progress_session_ready_push_present_subscribed_installation_null'
  | 'wonderpush_recovery_subscribe_permission_rejected'
  | 'wonderpush_recovery_subscribe_push_not_supported'
  | 'wonderpush_recovery_subscribe_subscription_state_rejected'
  | 'wonderpush_recovery_subscribe_wrong_context'
  | 'wonderpush_recovery_subscribe_storage_failed'
  | 'wonderpush_recovery_subscribe_dom_invalid_state'
  | 'wonderpush_recovery_subscribe_dom_abort'
  | 'wonderpush_recovery_subscribe_dom_network'
  | 'wonderpush_recovery_subscribe_provider_rejected'
  | 'wonderpush_recovery_subscribe_unknown_rejection'
  | 'legacy_push_subscription_absent' | 'legacy_subscription_replacement_failed'
  | 'wonderpush_session_initialization_failed'
  | 'legacy_unsubscribe_succeeded_wonderpush_resubscribe_rejected'
  | 'legacy_unsubscribe_succeeded_wonderpush_resubscribe_timed_out'
  | 'legacy_unsubscribe_succeeded_wonderpush_resubscribe_resolved_recovery_check_failed'
  | 'legacy_replacement_completed_subscription_present_installation_unavailable'
  | 'legacy_replacement_completed_subscription_absent_installation_unavailable'
  | 'legacy_replacement_completed_subscription_state_unavailable_installation_unavailable'
  | 'wonderpush_association_unsubscribe_rejected'
  | 'wonderpush_association_unsubscribe_timed_out'
  | 'wonderpush_association_unsubscribe_state_unavailable'
  | 'wonderpush_association_unsubscribe_state_still_subscribed'
  | 'wonderpush_association_subscribe_rejected'
  | 'wonderpush_association_subscribe_timed_out'
  | 'wonderpush_association_snapshot_failed'
  | 'legacy_association_recovery_subscribed_session_ready_installation_unavailable'
  | 'legacy_association_recovery_subscribed_session_not_ready_installation_unavailable'
  | 'legacy_association_recovery_not_subscribed_installation_unavailable'
  | 'legacy_association_recovery_subscription_state_unavailable';

export class WonderPushInstallationRecoveryError extends Error {
  constructor(public failureStage: WonderPushInstallationFailureStage) {
    super(`WonderPush installation recovery failed: ${failureStage}`);
    this.name = 'WonderPushInstallationRecoveryError';
  }
}

export async function getCurrentInstallationFingerprint(): Promise<string | null> {
  if (!isSupported()) return null;
  const installationId = (await readWonderPushSnapshot()).installationId;
  if (!installationId || !globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(installationId));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0'))
    .join('').slice(0, 10).toUpperCase();
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
