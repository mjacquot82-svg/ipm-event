export type NotificationState =
  | 'loading'
  | 'recovering'
  | 'default'
  | 'subscribed'
  | 'unsubscribed'
  | 'denied'
  | 'unsupported'
  | 'error';

export async function initializeWonderPush(): Promise<void> {
  return undefined;
}

export async function initializeOfflineShell(): Promise<null> {
  return null;
}

export async function waitForWonderPushSessionReady(): Promise<void> {
  return undefined;
}

export async function getNotificationState(): Promise<NotificationState> {
  return 'unsupported';
}

export async function subscribeToNotifications(): Promise<NotificationState> {
  return 'unsupported';
}

export async function unsubscribeFromNotifications(): Promise<NotificationState> {
  return 'unsupported';
}
