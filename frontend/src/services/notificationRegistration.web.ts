import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSubscribedInstallationId,
  WonderPushInstallationRecoveryError,
} from './wonderPushService.web';

const CAPABILITY_KEY = '@ipm_notification_capability_v1';
const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const REQUEST_TIMEOUT_MS = 12_000;
const RETRY_DELAYS_MS = [2_500, 5_000] as const;

export type NotificationRegistrationStage =
  | 'installation_retrieval' | 'capability_lookup' | 'backend_registration'
  | 'backend_status' | 'provider_verification' | 'success';
export type NotificationRegistrationFailure =
  | 'installation_unavailable' | 'invalid_credentials' | 'http_error' | 'timeout'
  | 'network_failure' | 'malformed_response' | 'sdk_unavailable'
  | 'installation_still_unavailable'
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
  | 'legacy_association_recovery_subscription_state_unavailable'
  | 'other';
export type NotificationRegistrationResult = {
  stage: 'success'; status: Record<string, unknown>; attempts: number;
};

export class NotificationRegistrationError extends Error {
  constructor(
    public stage: Exclude<NotificationRegistrationStage, 'success'>,
    public classification: NotificationRegistrationFailure,
    public retryable: boolean,
    public status: number | null = null,
  ) {
    super(`Notification setup failed at ${stage}: ${classification}${status ? ` (${status})` : ''}`);
    this.name = 'NotificationRegistrationError';
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function capability(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(CAPABILITY_KEY);
    if (stored) return stored;
    if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random generation is unavailable.');
    const created = base64Url(globalThis.crypto.getRandomValues(new Uint8Array(32)));
    await AsyncStorage.setItem(CAPABILITY_KEY, created);
    return created;
  } catch {
    throw new NotificationRegistrationError('capability_lookup', 'other', false);
  }
}

function safeRequestError(stage: Exclude<NotificationRegistrationStage, 'success'>,
  error: unknown): NotificationRegistrationError {
  if (error instanceof NotificationRegistrationError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new NotificationRegistrationError(stage, 'timeout', true);
  }
  if (error instanceof TypeError) {
    return new NotificationRegistrationError(stage, 'network_failure', true);
  }
  return new NotificationRegistrationError(stage, 'other', false);
}

async function request(path: string, method: string,
  stage: Exclude<NotificationRegistrationStage, 'success'>,
  deviceCapability: string, installationId: string | null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/notification-registrations${path}`, {
      method, signal: controller.signal,
      headers: {
        'X-Notification-Device-Capability': deviceCapability,
        ...(installationId ? { 'X-WonderPush-Installation-Id': installationId } : {}),
      },
    });
  } catch (error) {
    throw safeRequestError(stage, error);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const invalidCredentials = response.status === 400 || response.status === 401
      || response.status === 403 || response.status === 409;
    const retryable = response.status === 408 || response.status === 425
      || response.status === 429 || response.status >= 500;
    throw new NotificationRegistrationError(stage,
      invalidCredentials ? 'invalid_credentials' : 'http_error', retryable, response.status);
  }
  try {
    const body = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Malformed response');
    return body as Record<string, unknown>;
  } catch {
    throw new NotificationRegistrationError(stage, 'malformed_response', true);
  }
}

export async function runNotificationRegistrationAttempt(): Promise<Record<string, unknown>> {
  let installationId: string | null;
  try { installationId = await getSubscribedInstallationId(); }
  catch (error) {
    if (error instanceof WonderPushInstallationRecoveryError) {
      throw new NotificationRegistrationError('installation_retrieval', error.failureStage, true);
    }
    throw new NotificationRegistrationError('installation_retrieval', 'other', true);
  }
  if (!installationId) {
    throw new NotificationRegistrationError('installation_retrieval', 'installation_unavailable', true);
  }
  const deviceCapability = await capability();
  try {
    await request('/status-by-capability', 'GET', 'capability_lookup', deviceCapability, null);
  } catch (error) {
    if (!(error instanceof NotificationRegistrationError) || error.status !== 404) throw error;
  }
  // Register is capability-scoped and idempotent. Calling it for an existing
  // capability safely rebinds a migrated browser to its replacement WonderPush
  // installation; an installation owned by another capability remains rejected.
  await request('/register', 'POST', 'backend_registration', deviceCapability, installationId);
  await request('/status', 'GET', 'backend_status', deviceCapability, installationId);
  const readiness = await request('/readiness/verify', 'POST', 'provider_verification',
    deviceCapability, installationId);
  if (readiness.registered !== true || readiness.provider_deliverable !== true) {
    throw new NotificationRegistrationError('provider_verification', 'other', true);
  }
  return readiness;
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

export async function ensureNotificationRegistration(): Promise<NotificationRegistrationResult> {
  let lastError: NotificationRegistrationError | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const status = await runNotificationRegistrationAttempt();
      return { stage: 'success', status, attempts: attempt + 1 };
    } catch (error) {
      lastError = safeRequestError('installation_retrieval', error);
      if (!lastError.retryable || attempt === RETRY_DELAYS_MS.length) throw lastError;
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError || new NotificationRegistrationError('installation_retrieval', 'other', false);
}
