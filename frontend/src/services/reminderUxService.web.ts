import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFavorites } from '../utils/favoritesStorage';
import {
  configureItineraryReminderSync,
  disableItineraryReminderSync,
  getItineraryReminderReadiness,
} from './itineraryReminderSync.web';
import { getNotificationState, subscribeToNotifications } from './wonderPushService.web';
import { detectInstallEnvironment, detectStandaloneSignals } from '../utils/installEnvironment';
import { isReminderPromotionEligible, mayShowReminderPromotion } from './reminderUxPolicy';

const PROMPT_COUNT_KEY = '@ipm_itinerary_reminder_prompt_count_v1';

export type AttendeeReminderUiState = 'checking' | 'on' | 'off' | 'blocked' | 'install_required' | 'recovery';

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

export async function getAttendeeReminderStatus() {
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
    readiness = await getItineraryReminderReadiness({ verifyProvider: notificationState === 'subscribed' });
  } catch {
    return { state: 'checking' as const, reminderReady: false, readiness: null,
      failureStage: 'authoritative_verification_temporarily_unavailable' };
  }
  const redacted = {
    supported_context: readiness.client.supportedContext,
    browser_permission_granted: readiness.client.browserPermission === 'granted',
    sdk_ready: readiness.client.sdk === 'ready',
    subscribed: readiness.client.subscription === 'subscribed',
    current_installation_available: readiness.client.installation === 'available',
    registration_exists: Boolean(readiness.registration?.registered || readiness.registration?.registration_exists),
    installation_match: readiness.currentInstallationMatch === 'match',
    reminders_enabled: Boolean(readiness.registration?.reminders_enabled),
    synchronized_star_count: Number(readiness.registration?.synchronized_star_count
      ?? readiness.registration?.starred_count ?? 0),
    provider_reachability: readiness.registration?.provider_reachability || 'unknown',
    provider_deliverable: Boolean(readiness.registration?.provider_deliverable),
    provider_checked_at: readiness.registration?.provider_checked_at || null,
    provider_fresh: Boolean(readiness.registration?.provider_fresh),
    final_reminder_ready: readiness.reminderReady,
  };
  if (readiness.reminderReady) return { state: 'on' as const, reminderReady: true, readiness,
    diagnostics: redacted, failureStage: null };
  const registrationExists = Boolean(readiness?.registration?.registered
    || readiness?.registration?.registration_exists);
  if (!registrationExists) return { state: 'off' as const, reminderReady: false, readiness,
    diagnostics: redacted, failureStage: 'not_configured' };
  return { state: registrationExists ? 'recovery' as const : 'off' as const,
    reminderReady: false, readiness, diagnostics: redacted,
    failureStage: readiness.staleReason || 'confirmed_readiness_failure' };
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
