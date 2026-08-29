export type NotificationRegistrationStage =
  | 'installation_retrieval' | 'capability_lookup' | 'backend_registration'
  | 'backend_status' | 'provider_verification' | 'success';

export type NotificationRegistrationResult = {
  stage: 'success'; status: Record<string, unknown>; attempts: number;
};

export async function ensureNotificationRegistration(): Promise<NotificationRegistrationResult> {
  return { stage: 'success', status: {}, attempts: 1 };
}
