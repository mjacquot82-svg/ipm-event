// Expo Notifications is intentionally disabled on web. Browser push is owned
// exclusively by Webpushr, which is initialized separately in app/_layout.tsx.

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  return null;
}

export async function syncStarredEventsWithBackend(_starredEventIds: string[]): Promise<void> {
  return undefined;
}

export async function getStoredPushToken(): Promise<string | null> {
  return null;
}

export function addNotificationListeners(
  _onReceived: (notification: unknown) => void,
  _onResponse: (response: unknown) => void
) {
  return () => undefined;
}

export async function scheduleLocalNotification(
  _title: string,
  _body: string,
  _data?: Record<string, unknown>
): Promise<void> {
  return undefined;
}
