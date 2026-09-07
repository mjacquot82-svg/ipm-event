// Temporary staging-only snapshot. No SDK loading, initialization or recovery.
export const STAGING_ORIGIN = 'https://staging.theipm.ca';
const STATUS_URL = 'https://ipm-staging-backend.onrender.com/api/notification-registrations/status-by-capability';
const UNKNOWN = 'UNKNOWN';
const errorNames = new Set(['AbortError', 'InvalidStateError', 'NetworkError', 'NotAllowedError', 'SecurityError', 'TimeoutError', 'TypeError']);
export function safeError(error) {
  return errorNames.has(error?.name) ? error.name : 'OTHER_ERROR';
}
function safeTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return UNKNOWN;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : UNKNOWN;
}
async function bounded(read, milliseconds = 4000) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(read), new Promise((_, reject) => {
      timer = setTimeout(() => reject({ name: 'TimeoutError' }), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
export async function readPixelSnapshot(env = globalThis) {
  // Guard precedes every browser, storage, SDK and network read.
  if (env.location?.origin !== STAGING_ORIGIN) return { diagnostic: 'STAGING_ONLY' };
  const result = {
    observed_at: new Date().toISOString(),
    notification_permission: UNKNOWN,
    service_worker_controlled: UNKNOWN,
    active_worker_scope: UNKNOWN,
    wonderpush_worker_present: UNKNOWN,
    browser_push_subscription_present: UNKNOWN,
    wonderpush_local_subscribed: UNKNOWN,
    wonderpush_initialization_state: 'SDK_NOT_LOADED_IN_DIAGNOSTIC',
    installation_id_present: UNKNOWN,
    current_os_notification_visibility: 'UNKNOWN_NO_LIVE_READ',
    current_provider_token_present: 'UNKNOWN_NO_LIVE_READ',
    last_known_provider_check_at: UNKNOWN,
    stored_provider_token_present: UNKNOWN,
    stored_provider_deliverable: UNKNOWN,
    stored_provider_reachability: UNKNOWN,
    stored_provider_read: 'NOT_ATTEMPTED',
    worker_init_error_class: 'UNKNOWN_NOT_OBSERVABLE',
    diagnostic_read_error_class: 'NONE',
  };
  const permission = env.Notification?.permission;
  if (['granted', 'denied', 'default'].includes(permission)) result.notification_permission = permission;
  else if (!env.Notification) result.notification_permission = 'UNSUPPORTED';
  const serviceWorker = env.navigator?.serviceWorker;
  if (!serviceWorker) {
    result.service_worker_controlled = false;
    result.active_worker_scope = 'UNSUPPORTED';
    result.wonderpush_worker_present = false;
  } else {
    result.service_worker_controlled = Boolean(serviceWorker.controller);
    try {
      // getRegistration and getSubscription read existing state; never use ready,
      // register, update, subscribe, unsubscribe, postMessage or a push simulator.
      const registration = await bounded(() => serviceWorker.getRegistration('/'));
      result.active_worker_scope = !registration?.active ? 'NONE'
        : registration.scope === `${STAGING_ORIGIN}/` ? 'STAGING_ROOT' : 'OTHER';
      result.wonderpush_worker_present = Boolean(registration?.active
        && new URL(registration.active.scriptURL).origin === STAGING_ORIGIN
        && new URL(registration.active.scriptURL).pathname === '/webpushr-sw.js');
      result.browser_push_subscription_present = registration?.pushManager
        ? Boolean(await bounded(() => registration.pushManager.getSubscription())) : false;
    } catch (error) { result.diagnostic_read_error_class = safeError(error); }
  }
  // These getters are used only if an SDK already exists in this document.
  // The isolated page deliberately does not load it: doing so can register or
  // update provider state. Missing SDK context is unknown, not unsubscribed.
  const sdk = env.WonderPush;
  if (sdk && !Array.isArray(sdk)) {
    try {
      if (typeof sdk.getSessionState === 'function') {
        const state = sdk.getSessionState();
        result.wonderpush_initialization_state = ['INIT_FAILED', 'INIT_UNSTARTED', 'INIT_INPROGRESS', 'INIT_SUCCESS']
          .find((name) => sdk.SessionState?.[name] !== undefined && sdk.SessionState[name] === state) || UNKNOWN;
      }
      if (typeof sdk.isSubscribedToNotifications === 'function') {
        const subscribed = await bounded(() => sdk.isSubscribedToNotifications());
        result.wonderpush_local_subscribed = typeof subscribed === 'boolean' ? subscribed : UNKNOWN;
      }
      if (typeof sdk.getInstallationId === 'function') {
        const id = await bounded(() => sdk.getInstallationId());
        result.installation_id_present = typeof id === 'string' ? id.length > 0 : id === null ? false : UNKNOWN;
      }
    } catch (error) { result.diagnostic_read_error_class = safeError(error); }
  }
  // Read only an EXISTING capability. Do not call the application's identity
  // helper, which creates one if absent. Do not render/store the capability.
  let capability;
  try { capability = env.localStorage?.getItem('@ipm_notification_capability_v1'); }
  catch (error) { result.diagnostic_read_error_class = safeError(error); }
  if (!capability || !/^[A-Za-z0-9_-]{43}$/.test(capability)) {
    result.stored_provider_read = 'NO_EXISTING_CAPABILITY';
    return result;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await env.fetch(STATUS_URL, {
      method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { 'X-Notification-Device-Capability': capability }, signal: controller.signal,
    });
    if (!response.ok) {
      result.stored_provider_read = response.status === 404 ? 'REGISTRATION_NOT_FOUND' : 'HTTP_ERROR';
      return result;
    }
    const body = await response.json();
    result.last_known_provider_check_at = safeTimestamp(body?.provider_checked_at);
    result.stored_provider_token_present = typeof body?.provider_has_push_token === 'boolean' ? body.provider_has_push_token : UNKNOWN;
    result.stored_provider_deliverable = typeof body?.provider_deliverable === 'boolean' ? body.provider_deliverable : UNKNOWN;
    result.stored_provider_reachability = ['optIn', 'optOut', 'softOptOut', 'unknown'].includes(body?.provider_reachability) ? body.provider_reachability : UNKNOWN;
    result.stored_provider_read = 'READ_STORED_ONLY';
  } catch (error) {
    result.stored_provider_read = 'READ_FAILED';
    result.diagnostic_read_error_class = safeError(error);
  } finally { clearTimeout(timer); }
  return result;
}
