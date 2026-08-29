import { wonderPushAnnouncementDestination } from './notificationDeepLinkCore';

export function listenForWonderPushNotificationDeepLinks(navigate: (destination: string) => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return () => undefined;
  const onMessage = (event: MessageEvent) => {
    const destination = wonderPushAnnouncementDestination(event.data, window.location.origin);
    if (destination) navigate(destination);
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}
