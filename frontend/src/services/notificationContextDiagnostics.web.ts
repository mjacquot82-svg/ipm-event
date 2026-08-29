import { getAttendeeReminderStatus } from './reminderUxService.web';
import { getWonderPushDiagnostics } from './wonderPushService.web';
import {
  buildRawNotificationObservations,
  interpretInstalledContext,
  NotificationContextDiagnostic,
  TriState,
} from './notificationContextDiagnosticCore';

const tri = (value: boolean | null | undefined): TriState => value === true ? 'YES' : value === false ? 'NO' : 'UNKNOWN';

export async function getNotificationContextDiagnostic(): Promise<NotificationContextDiagnostic> {
  const media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches : null;
  const navigatorStandalone = typeof window.navigator.standalone === 'boolean'
    ? window.navigator.standalone : null;
  const serviceWorkerAvailable = Boolean(navigator.serviceWorker);
  let registrationAvailable: boolean | null = serviceWorkerAvailable ? null : false;
  if (serviceWorkerAvailable) {
    try { registrationAvailable = Boolean(await navigator.serviceWorker.getRegistration('/')); }
    catch { registrationAvailable = null; }
  }

  const wonderPush = await getWonderPushDiagnostics();
  // Diagnostic collection may read current backend status but never triggers provider verification.
  const reminder = await getAttendeeReminderStatus({ verifyProvider: false });
  const diagnostics = reminder.diagnostics;
  const providerKnown = diagnostics?.provider_deliverable !== null
    && diagnostics?.provider_deliverable !== undefined;
  const providerUnavailable = reminder.failureStage === 'backend_authoritative_verification'
    || reminder.failureStage === 'provider_verification';

  return {
    raw: buildRawNotificationObservations({
      userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
      displayModeStandalone: media, navigatorStandalone,
      notificationAvailable: 'Notification' in window,
      notificationPermission: typeof Notification === 'undefined' ? undefined : Notification.permission,
      serviceWorkerAvailable, pushManagerAvailable: 'PushManager' in window,
      serviceWorkerRegistrationAvailable: registrationAvailable,
      controllingServiceWorker: Boolean(navigator.serviceWorker?.controller),
      wonderPushSdkLoaded: Boolean(window.WonderPush),
    }),
    derived: {
      installedContext: interpretInstalledContext(media, navigatorStandalone),
      wonderPushSdkReady: tri(wonderPush.sdk === 'ready' ? true
        : wonderPush.failureStage === 'wonderpush_sdk_initialization' ? false : null),
      wonderPushSubscribed: tri(wonderPush.subscription === 'subscribed' ? true
        : wonderPush.subscription === 'not-subscribed' ? false : null),
      currentInstallationAvailable: tri(wonderPush.installation === 'available' ? true
        : wonderPush.sdk === 'ready' ? false : null),
      backendRegistrationExists: tri(diagnostics?.registration_exists),
      installationMatchesRegistration: tri(diagnostics?.installation_match),
      providerReadiness: providerUnavailable ? 'UNAVAILABLE'
        : providerKnown ? diagnostics?.final_reminder_ready ? 'READY' : 'NOT READY' : 'UNKNOWN',
      failureStage: reminder.failureStage || 'none',
      backendFailure: reminder.backendFailure || 'none',
    },
  };
}
