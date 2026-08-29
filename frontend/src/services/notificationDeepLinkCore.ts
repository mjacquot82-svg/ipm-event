type UnknownRecord = Record<string, unknown>;

const ANNOUNCEMENT_DETAIL_PATH = /^\/announcements\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' ? value as UnknownRecord : null;
}

export function safeAnnouncementDestination(value: unknown, currentOrigin: string): string | null {
  if (typeof value !== 'string') return null;
  try {
    const target = new URL(value);
    if (target.origin !== currentOrigin || target.username || target.password) return null;
    if (!ANNOUNCEMENT_DETAIL_PATH.test(target.pathname)) return null;
    return target.pathname;
  } catch {
    return null;
  }
}

export function wonderPushAnnouncementDestination(message: unknown, currentOrigin: string): string | null {
  const envelope = record(message);
  if (envelope?.sdk !== 'wonderpush-jssdk' || envelope.type !== 'nativeNotificationOpen') return null;
  const notification = record(envelope.data);
  const wonderPush = record(notification?._wp);
  return safeAnnouncementDestination(wonderPush?.targetUrl, currentOrigin);
}
