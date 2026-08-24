import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFavorites } from '../utils/favoritesStorage';
import {
  configureItineraryReminderSync,
  disableItineraryReminderSync,
  getItineraryReminderReadiness,
} from './itineraryReminderSync.web';
import { getNotificationState, subscribeToNotifications } from './wonderPushService.web';

const PROMPT_COUNT_KEY = '@ipm_itinerary_reminder_prompt_count_v1';
const MAX_PROMPT_SHOWS = 2;

export async function getAttendeeReminderStatus() {
  return getItineraryReminderReadiness();
}

export async function shouldShowReminderPromotion(): Promise<boolean> {
  const readiness = await getItineraryReminderReadiness().catch(() => null);
  if (readiness?.reminderReady) return false;
  const count = Number(await AsyncStorage.getItem(PROMPT_COUNT_KEY) || '0');
  if (count >= MAX_PROMPT_SHOWS) return false;
  await AsyncStorage.setItem(PROMPT_COUNT_KEY, String(count + 1));
  return true;
}

export async function enableAttendeeItineraryReminders() {
  let notificationState = await getNotificationState();
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
