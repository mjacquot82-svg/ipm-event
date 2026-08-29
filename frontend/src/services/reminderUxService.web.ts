import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFavorites } from '../utils/favoritesStorage';
import {
  configureItineraryReminderSync,
  disableItineraryReminderSync,
  getItineraryReminderReadiness,
  ItineraryReadinessError,
} from './itineraryReminderSync.web';
import { getNotificationState, subscribeToNotifications, WonderPushClientReadiness } from './wonderPushService.web';
import { detectInstallEnvironment, detectStandaloneSignals } from '../utils/installEnvironment';
import { isReminderPromotionEligible, mayShowReminderPromotion } from './reminderUxPolicy';

const PROMPT_COUNT_KEY = '@ipm_itinerary_reminder_prompt_count_v1';
const REMINDER_SYNC_ENABLED_KEY = '@ipm_itinerary_reminders_enabled_v1';

export type AttendeeReminderUiState = 'checking' | 'on' | 'off' | 'blocked' | 'install_required' | 'recovery';

function redactedDiagnostics(client: WonderPushClientReadiness,
  registration: Record<string, any> | null = null, installationMatch: string = 'unavailable',
  registrationLookupCompleted = registration !== null, localReminderSyncEnabled: boolean | null = null) {
  return {
    installed_context: isStandalone(),
    notification_api_available: typeof Notification !== 'undefined',
    service_worker_available: Boolean(navigator.serviceWorker),
    push_manager_available: typeof PushManager !== 'undefined',
    supported_context: client.supportedContext,
    browser_permission_granted: client.browserPermission === 'granted',
    sdk_ready: client.sdk === 'ready',
    subscribed: client.subscription === 'subscribed',
    current_installation_available: client.installation === 'available',
    registration_exists: registrationLookupCompleted
      ? Boolean(registration?.registered || registration?.registration_exists) : null,
    installation_match: installationMatch === 'unavailable' ? null : installationMatch === 'match',
    reminders_enabled: registration ? Boolean(registration.reminders_enabled) : null,
    local_reminder_sync_enabled: localReminderSyncEnabled,
    synchronized_star_count: registration
      ? Number(registration.synchronized_star_count ?? registration.starred_count ?? 0) : null,
    provider_reachability: registration?.provider_reachability || null,
    provider_deliverable: registration ? Boolean(registration.provider_deliverable) : null,
    provider_checked_at: registration?.provider_checked_at || null,
    provider_fresh: registration ? Boolean(registration.provider_fresh) : null,
    final_reminder_ready: registration ? Boolean(registration.final_reminder_ready) : null,
  };
}

function isStandalone() {
  return detectStandaloneSignals({
    displayModeStandalone: Boolean(window.matchMedia?.('(display-mode: standalone)').matches),
    navigatorStandalone: window.navigator.standalone === true,
    referrer: document.referrer,
  });
}

export function requiresIphoneHomeScreenInstall() {
  const environment = detectInstallEnvironment({
    userAgent: navigator.userAgent, platformHint: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints, standalone: isStandalone(),
  });
  return environment.platform === 'ios' && environment.installState !== 'installed';
}

export async function getAttendeeReminderStatus({ verifyProvider = true } = {}) {
  if (requiresIphoneHomeScreenInstall()) {
    return { state: 'install_required' as const, reminderReady: false, readiness: null,
      failureStage: 'iphone_home_screen_required' };
  }
  const notificationState = await getNotificationState();
  if (notificationState === 'denied') {
    return { state: 'blocked' as const, reminderReady: false, readiness: null,
      failureStage: 'browser_permission_denied' };
  }
  if (notificationState === 'error') {
    return { state: 'checking' as const, reminderReady: false, readiness: null,
      failureStage: 'client_status_temporarily_unavailable' };
  }
  let readiness;
  try {
    readiness = await getItineraryReminderReadiness({
      verifyProvider: verifyProvider && notificationState === 'subscribed',
    });
    if (verifyProvider && notificationState !== 'subscribed' && readiness.client.clientReady) {
      readiness = await getItineraryReminderReadiness({ verifyProvider: true });
    }
  } catch (error) {
    if (error instanceof ItineraryReadinessError) {
      let localReminderSyncEnabled: boolean | null = null;
      try { localReminderSyncEnabled = await AsyncStorage.getItem(REMINDER_SYNC_ENABLED_KEY) === 'true'; }
      catch { /* Preserve other locally known diagnostics when storage is unavailable. */ }
      return { state: 'checking' as const, reminderReady: false, readiness: null,
        diagnostics: redactedDiagnostics(error.client, error.registration, 'unavailable',
          error.registrationLookupCompleted, localReminderSyncEnabled),
        failureStage: error.stage, backendFailure: error.classification };
    }
    return { state: 'checking' as const, reminderReady: false, readiness: null,
      failureStage: 'authoritative_verification_temporarily_unavailable', backendFailure: 'UNKNOWN ERROR' };
  }
  let localReminderSyncEnabled: boolean | null = null;
  try {
    localReminderSyncEnabled = await AsyncStorage.getItem(REMINDER_SYNC_ENABLED_KEY) === 'true';
  } catch {
    // Diagnostics remain read-only and must never change the attendee reminder state.
  }
  const localStarCount = (await getFavorites()).length;
  const synchronizedStarCount = Number(readiness.registration?.synchronized_star_count
    ?? readiness.registration?.starred_count ?? 0);
  const fullySynchronized = synchronizedStarCount === localStarCount;
  const redacted = { ...redactedDiagnostics(readiness.client, readiness.registration,
    readiness.currentInstallationMatch, true, localReminderSyncEnabled),
    synchronized_star_count: synchronizedStarCount,
    final_reminder_ready: readiness.reminderReady && fullySynchronized };
  if (readiness.reminderReady && fullySynchronized) return { state: 'on' as const, reminderReady: true, readiness,
    diagnostics: redacted, failureStage: null };
  const registrationExists = Boolean(readiness?.registration?.registered
    || readiness?.registration?.registration_exists);
  if (!registrationExists) return { state: 'off' as const, reminderReady: false, readiness,
    diagnostics: redacted, failureStage: 'not_configured' };
  return { state: registrationExists ? 'recovery' as const : 'off' as const,
    reminderReady: false, readiness, diagnostics: redacted,
    failureStage: fullySynchronized ? readiness.staleReason || 'confirmed_readiness_failure'
      : 'star_synchronization_outstanding' };
}

export async function shouldShowReminderPromotion(event: { start_date: string; start_time: string }): Promise<boolean> {
  if (!isReminderPromotionEligible(event)) return false;
  const readiness = await getItineraryReminderReadiness().catch(() => null);
  const count = Number(await AsyncStorage.getItem(PROMPT_COUNT_KEY) || '0');
  if (!mayShowReminderPromotion({ starSucceeded: true, becameFavorite: true,
    reminderReady: Boolean(readiness?.reminderReady), promptShows: count,
    eventEligible: isReminderPromotionEligible(event) })) return false;
  await AsyncStorage.setItem(PROMPT_COUNT_KEY, String(count + 1));
  return true;
}

export async function enableAttendeeItineraryReminders() {
  if (requiresIphoneHomeScreenInstall()) {
    return { enabled: false, notificationState: 'requires_install' as const, readiness: null };
  }
  let notificationState = await getNotificationState();
  if (notificationState === 'denied') return { enabled: false, notificationState, readiness: null };
  if (notificationState !== 'subscribed') notificationState = await subscribeToNotifications();
  if (notificationState !== 'subscribed') {
    return { enabled: false, notificationState, readiness: null };
  }
  try {
    const readiness = await configureItineraryReminderSync(await getFavorites());
    return { enabled: readiness.reminderReady, notificationState, readiness, transient: false };
  } catch {
    return { enabled: false, notificationState, readiness: null, transient: true };
  }
}

export async function disableAttendeeItineraryReminders() {
  await disableItineraryReminderSync();
  return getItineraryReminderReadiness();
}
