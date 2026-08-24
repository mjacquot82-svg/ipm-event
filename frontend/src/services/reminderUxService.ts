type NativeReminderReadiness = { reminderReady?: boolean } | null;
export async function getAttendeeReminderStatus(): Promise<NativeReminderReadiness> { return null; }
export async function shouldShowReminderPromotion() { return false; }
export async function enableAttendeeItineraryReminders() {
  return { enabled: false, notificationState: 'unsupported', readiness: null as NativeReminderReadiness };
}
export async function disableAttendeeItineraryReminders(): Promise<NativeReminderReadiness> { return null; }
