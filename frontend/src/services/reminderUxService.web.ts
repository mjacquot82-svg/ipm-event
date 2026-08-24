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

export type AttendeeReminderUiState = 'on' | 'off' | 'blocked' | 'install_required' | 'recovery';

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
    return { state: 'install_required' as const, reminderReady: false, readiness: null };
  }
  const notificationState = await getNotificationState();
  if (notificationState === 'denied') {
    return { state: 'blocked' as const, reminderReady: false, readiness: null };
  }
  const readiness = await getItineraryReminderReadiness().catch(() => null);
  if (readiness?.reminderReady) return { state: 'on' as const, reminderReady: true, readiness };
  const registrationExists = Boolean(readiness?.registration?.registered);
  return { state: registrationExists ? 'recovery' as const : 'off' as const,
    reminderReady: false, readiness };
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
  await configureItineraryReminderSync(await getFavorites());
  return { enabled: true, notificationState, readiness: await getItineraryReminderReadiness() };
}

export async function disableAttendeeItineraryReminders() {
  await disableItineraryReminderSync();
  return getItineraryReminderReadiness();
}
