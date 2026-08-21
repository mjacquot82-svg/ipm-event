export type NotificationState =
  | 'loading'
  | 'default'
  | 'subscribed'
  | 'unsubscribed'
  | 'denied'
  | 'unsupported'
  | 'error';

export async function initializeWonderPush(): Promise<void> {
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
