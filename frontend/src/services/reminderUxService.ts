type NativeReminderReadiness = { reminderReady?: boolean; state?: string; failureStage?: string | null } | null;
export async function getAttendeeReminderStatus(): Promise<NativeReminderReadiness> { return { reminderReady: false, state: 'off', failureStage: null }; }
export async function shouldShowReminderPromotion(_event: { start_date: string; start_time: string }) { return false; }
export async function enableAttendeeItineraryReminders() {
  return { enabled: false, notificationState: 'unsupported', readiness: null as NativeReminderReadiness, transient: false };
}
export async function disableAttendeeItineraryReminders(): Promise<NativeReminderReadiness> { return null; }
