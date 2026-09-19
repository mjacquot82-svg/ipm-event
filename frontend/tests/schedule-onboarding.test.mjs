import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schedule = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const itinerary = await readFile(new URL('../app/(tabs)/itinerary.tsx', import.meta.url), 'utf8');
const favorites = await readFile(new URL('../src/utils/favoritesStorage.ts', import.meta.url), 'utf8');
const onboardingState = await readFile(new URL('../src/services/scheduleOnboardingState.ts', import.meta.url), 'utf8');

const SCHEDULE_ONBOARDING_ACKNOWLEDGED_KEY = '@ipm_schedule_itinerary_onboarding_v1';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
}

async function hasAcknowledgedScheduleOnboarding(storage) {
  return await storage.getItem(SCHEDULE_ONBOARDING_ACKNOWLEDGED_KEY) === 'true';
}

async function acknowledgeScheduleOnboarding(storage) {
  await storage.setItem(SCHEDULE_ONBOARDING_ACKNOWLEDGED_KEY, 'true');
}

async function resetScheduleOnboarding(storage) {
  await storage.removeItem(SCHEDULE_ONBOARDING_ACKNOWLEDGED_KEY);
}

test('first meaningful Schedule visit overlays the already-loaded Schedule with a modal', () => {
  const scheduleListIndex = schedule.indexOf('<SectionList');
  const onboardingModalIndex = schedule.indexOf('visible={showScheduleOnboarding}');
  assert.ok(scheduleListIndex >= 0 && onboardingModalIndex > scheduleListIndex);
  assert.match(schedule, /<Modal[\s\S]*visible=\{showScheduleOnboarding\}[\s\S]*animationType="fade"[\s\S]*transparent=\{true\}/);
  assert.match(schedule, /onboardingModalOverlay:[\s\S]*rgba\(20, 28, 23, 0\.58\)/);
  assert.match(schedule, /role="dialog"/);
  assert.match(schedule, /accessibilityViewIsModal=\{true\}/);
  assert.doesNotMatch(schedule, /onboardingCard/);
  assert.match(schedule, /Star events to add them to your itinerary\./);
  assert.match(schedule, />Got it</);
  assert.match(schedule, /onboardingModalCard:[\s\S]*maxWidth: 440[\s\S]*borderRadius: 22/);
  assert.match(schedule, /onboardingModalScrollContent:[\s\S]*flexGrow: 1[\s\S]*paddingVertical: 28/);
  assert.match(schedule, /onboardingModalDismiss:[\s\S]*minHeight: 52/);
});

test('modal blocks background interaction and supports accessible dismissal', () => {
  assert.match(schedule, /onRequestClose=\{skipScheduleWalkthrough\}/);
  assert.match(schedule, /onboardingDismissRef[\s\S]*dismissButton\?\.focus\?\.\(\)/);
  assert.match(schedule, /accessibilityLabel="Got it, close Plan your day introduction"/);
  assert.doesNotMatch(schedule, /onboardingModalDismissArea|Dismiss Plan your day backdrop/);
});

test('onboarding acknowledgement persists, suppresses reopening, and has a versioned reset', async () => {
  const storage = memoryStorage();
  assert.match(onboardingState, /export const SCHEDULE_ONBOARDING_ACKNOWLEDGED_KEY = '@ipm_schedule_itinerary_onboarding_v1'/);
  assert.match(onboardingState, /export async function hasAcknowledgedScheduleOnboarding/);
  assert.match(onboardingState, /export async function acknowledgeScheduleOnboarding/);
  assert.match(onboardingState, /export async function resetScheduleOnboarding/);
  assert.equal(await hasAcknowledgedScheduleOnboarding(storage), false);
  await acknowledgeScheduleOnboarding(storage);
  assert.equal(await hasAcknowledgedScheduleOnboarding(storage), true);
  await resetScheduleOnboarding(storage);
  assert.equal(await hasAcknowledgedScheduleOnboarding(storage), false);
  assert.match(schedule, /hasAcknowledgedScheduleOnboarding\(AsyncStorage\)/);
  assert.match(schedule, /acknowledgeScheduleOnboarding\(AsyncStorage\)/);
  assert.match(schedule, /if \(!acknowledged \|\| \(walkthroughPreview && !previewStarted.current\)\)[\s\S]*setShowScheduleOnboarding\(true\)/);
});

test('pre-cutover reminder wording is future-facing, approximate, and eligibility-qualified', () => {
  assert.match(schedule, /If notifications are enabled, we&apos;ll remind you approximately 30 minutes before each event starts\./);
  assert.doesNotMatch(schedule, /exactly 30 minutes/i);
  assert.doesNotMatch(schedule, /WonderPush|kill switch|T-30|installation ID|provider readiness/i);
  assert.doesNotMatch(itinerary, /You'll receive a reminder|We'll remind you before/);
  assert.match(itinerary, /reconcileAttendeeItineraryReminders/);
});

test('successful star confirms itinerary addition and unstar remains unchanged', () => {
  const handler = schedule.match(/const handleToggleFavorite[\s\S]*?^  \};/m)?.[0] || '';
  assert.match(handler, /toggleFavorite\(eventId\)/);
  assert.match(handler, /starSucceeded[\s\S]*setShowStarConfirmation\(true\)/);
  assert.match(schedule, /Added to your itinerary/);
  assert.match(favorites, /isFavorite[\s\S]*removeFavorite\(sessionId\)[\s\S]*addFavorite\(sessionId\)/);
  assert.match(itinerary, /events\.filter\(\(event\) => favorites\.includes\(event\.id\)\)/);
});

test('itinerary refreshes controlled-test discovery after star reconciliation', () => {
  assert.match(itinerary, /await reconcileAttendeeItineraryReminders\(storedFavorites\);[\s\S]*await refreshControlledReminder\(\);/);
  assert.match(itinerary, /await reconcileAttendeeItineraryReminders\(result\.favorites\);[\s\S]*await refreshControlledReminder\(\);/);
  assert.match(itinerary, /const refreshControlledReminder = useCallback/);
});

test('Schedule stars are outlined when unselected and solid yellow when selected', () => {
  assert.match(schedule, /name=\{isFavorite \? 'star' : 'star-o'\}/);
  assert.match(schedule, /name=\{favorites\.includes\(selectedEvent\.id\) \? 'star' : 'star-o'\}/);
  assert.match(schedule, /color=\{isFavorite \? colors\.accentLight : colors\.textSecondary\}/);
  assert.match(schedule, /accessibilityState=\{\{ selected: isFavorite \}\}/);
});

test('contradictory post-star reminder offer is consolidated without notification changes', () => {
  assert.doesNotMatch(schedule, /showReminderPrompt|enableRemindersFromPrompt|Get event reminders/);
  assert.doesNotMatch(schedule, /shouldShowReminderPromotion|enableAttendeeItineraryReminders/);
  assert.doesNotMatch(schedule, /calendarService|exportScheduleEvent|getGoogleCalendarUrl|showCalendarChooser/);
});

test('Schedule filtering and category controls remain present', () => {
  assert.match(schedule, /showFavoritesOnly && !favorites\.includes\(event\.id\)/);
  assert.match(schedule, /getScheduleCategoryStyle/);
  assert.match(schedule, /categorySheetTitle/);
  assert.match(schedule, /selectedCategory === category/);
});
