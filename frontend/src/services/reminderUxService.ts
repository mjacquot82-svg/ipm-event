type NativeReminderReadiness = { reminderReady?: boolean; state?: string; failureStage?: string | null;
  backendFailure?: string | null;
  diagnostics?: Record<string, boolean | number | string | null | undefined> | null } | null;
export async function getAttendeeReminderStatus(_options: { verifyProvider?: boolean } = {}): Promise<NativeReminderReadiness> {
  return { reminderReady: false, state: 'off', failureStage: null, diagnostics: null };
}
export async function shouldShowReminderPromotion(_event: { start_date: string; start_time: string }) { return false; }
export async function enableAttendeeItineraryReminders() {
  return { enabled: false, notificationState: 'unsupported', readiness: null as NativeReminderReadiness, transient: false };
}
export async function disableAttendeeItineraryReminders(): Promise<NativeReminderReadiness> { return null; }
