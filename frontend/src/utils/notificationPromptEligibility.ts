export const NOTIFICATION_PROMPT_DISMISSED_AT_KEY = 'notification_prompt_dismissed_at_v1';
export const NOTIFICATION_PROMPT_DAILY_STATE_KEY = 'notification_prompt_daily_state_v1';
export const NOTIFICATION_PROMPT_COOLDOWN_MS = 4 * 60 * 60 * 1000;
export const NOTIFICATION_PROMPT_DAILY_LIMIT = 2;
export const NOTIFICATION_PROMPT_TIME_ZONE = 'America/Toronto';

export type NotificationPromptDailyState = {
  day: string;
  count: number;
};

export function getTorontoCalendarDay(now: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NOTIFICATION_PROMPT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function parseNotificationPromptDailyState(value: string | null): NotificationPromptDailyState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<NotificationPromptDailyState>;
    if (typeof parsed.day !== 'string' || !Number.isInteger(parsed.count) || Number(parsed.count) < 0) return null;
    return { day: parsed.day, count: Number(parsed.count) };
  } catch {
    return null;
  }
}

export function isNotificationPromptEligible({
  now,
  dismissedAt,
  dailyState,
}: {
  now: number;
  dismissedAt: string | null;
  dailyState: NotificationPromptDailyState | null;
}): boolean {
  const dismissedTime = Number(dismissedAt);
  if (Number.isFinite(dismissedTime) && dismissedTime > 0 && now - dismissedTime < NOTIFICATION_PROMPT_COOLDOWN_MS) {
    return false;
  }
  const today = getTorontoCalendarDay(now);
  return dailyState?.day !== today || dailyState.count < NOTIFICATION_PROMPT_DAILY_LIMIT;
}

export function nextNotificationPromptDailyState(
  now: number,
  current: NotificationPromptDailyState | null,
): NotificationPromptDailyState {
  const today = getTorontoCalendarDay(now);
  return { day: today, count: current?.day === today ? current.count + 1 : 1 };
}
