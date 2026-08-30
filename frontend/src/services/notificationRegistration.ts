export type NotificationRegistrationStage =
  | 'installation_retrieval' | 'capability_lookup' | 'backend_registration'
  | 'backend_status' | 'provider_verification' | 'success';

export type NotificationRegistrationFailure =
  | 'installation_unavailable' | 'invalid_credentials' | 'http_error' | 'timeout'
  | 'network_failure' | 'malformed_response' | 'sdk_unavailable'
  | 'session_recovery_failed' | 'installation_still_unavailable' | 'other';

export type NotificationRegistrationResult = {
  stage: 'success'; status: Record<string, unknown>; attempts: number;
};

export async function ensureNotificationRegistration(): Promise<NotificationRegistrationResult> {
  return { stage: 'success', status: {}, attempts: 1 };
}
