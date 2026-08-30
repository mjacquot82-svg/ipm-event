export type NotificationRegistrationStage =
  | 'installation_retrieval' | 'capability_lookup' | 'backend_registration'
  | 'backend_status' | 'provider_verification' | 'success';

export type NotificationRegistrationFailure =
  | 'installation_unavailable' | 'invalid_credentials' | 'http_error' | 'timeout'
  | 'network_failure' | 'malformed_response' | 'sdk_unavailable'
  | 'session_recovery_failed' | 'installation_still_unavailable'
  | 'legacy_push_subscription_absent' | 'legacy_subscription_replacement_failed'
  | 'wonderpush_session_initialization_failed'
  | 'legacy_unsubscribe_succeeded_wonderpush_resubscribe_rejected'
  | 'legacy_unsubscribe_succeeded_wonderpush_resubscribe_timed_out'
  | 'legacy_unsubscribe_succeeded_wonderpush_resubscribe_resolved_recovery_check_failed'
  | 'legacy_replacement_completed_subscription_present_installation_unavailable'
  | 'legacy_replacement_completed_subscription_absent_installation_unavailable'
  | 'legacy_replacement_completed_subscription_state_unavailable_installation_unavailable'
  | 'other';

export type NotificationRegistrationResult = {
  stage: 'success'; status: Record<string, unknown>; attempts: number;
};

export async function ensureNotificationRegistration(): Promise<NotificationRegistrationResult> {
  return { stage: 'success', status: {}, attempts: 1 };
}
