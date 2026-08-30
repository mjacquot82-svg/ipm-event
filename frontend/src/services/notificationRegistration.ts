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

export async function ensureNotificationRegistration(): Promise<NotificationRegistrationResult> {
  return { stage: 'success', status: {}, attempts: 1 };
}
