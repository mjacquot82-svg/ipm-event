type NativeReminderReadiness = { reminderReady?: boolean; state?: string } | null;
export async function getAttendeeReminderStatus(): Promise<NativeReminderReadiness> { return { reminderReady: false, state: 'off' }; }
export async function shouldShowReminderPromotion(_event: { start_date: string; start_time: string }) { return false; }
export async function enableAttendeeItineraryReminders() {
  return { enabled: false, notificationState: 'unsupported', readiness: null as NativeReminderReadiness };
}
export async function disableAttendeeItineraryReminders(): Promise<NativeReminderReadiness> { return null; }
