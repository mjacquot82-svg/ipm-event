import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  SCHEDULE_ONBOARDING_ACKNOWLEDGED_KEY,
  acknowledgeScheduleOnboarding,
  hasAcknowledgedScheduleOnboarding,
  resetScheduleOnboarding,
} from '../src/services/scheduleOnboardingState.ts';

const schedule = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const itinerary = await readFile(new URL('../app/(tabs)/itinerary.tsx', import.meta.url), 'utf8');
const favorites = await readFile(new URL('../src/utils/favoritesStorage.ts', import.meta.url), 'utf8');
const worker = await readFile(new URL('../../backend/server.py', import.meta.url), 'utf8');
const wonderPush = await readFile(new URL('../src/services/wonderPushService.web.ts', import.meta.url), 'utf8');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
}

test('first meaningful Schedule visit shows compact Plan your day education', () => {
  assert.match(schedule, /showScheduleOnboarding[\s\S]*Plan your day/);
  assert.match(schedule, /Tap the ⭐ on events you don&apos;t want to miss\. They&apos;ll be added to your Personal Itinerary\./);
  assert.match(schedule, /View Personal Itinerary/);
  assert.match(schedule, />Got it</);
  assert.match(schedule, /onboardingCard:[\s\S]*flexDirection: 'row'[\s\S]*borderRadius: 16/);
  assert.match(schedule, /onboardingActions:[\s\S]*flexWrap: 'wrap'/);
});

test('onboarding acknowledgement persists, suppresses reopening, and has a versioned reset', async () => {
  const storage = memoryStorage();
  assert.equal(SCHEDULE_ONBOARDING_ACKNOWLEDGED_KEY, '@ipm_schedule_itinerary_onboarding_v1');
  assert.equal(await hasAcknowledgedScheduleOnboarding(storage), false);
  await acknowledgeScheduleOnboarding(storage);
  assert.equal(await hasAcknowledgedScheduleOnboarding(storage), true);
  await resetScheduleOnboarding(storage);
  assert.equal(await hasAcknowledgedScheduleOnboarding(storage), false);
  assert.match(schedule, /IS_STAGING && resetOnboarding === '1'/);
});

test('pre-cutover reminder wording is future-facing, approximate, and eligibility-qualified', () => {
  assert.match(schedule, /Event reminders about 30 minutes before eligible events will also be available with notifications enabled\./);
  assert.doesNotMatch(schedule, /we(?:'|’)ll remind you|we will remind you|exactly 30 minutes/i);
  assert.doesNotMatch(schedule, /WonderPush|kill switch|T-30|installation ID|provider readiness/i);
  assert.doesNotMatch(itinerary, /You'll receive a reminder|We'll remind you before/);
  assert.match(itinerary, /Event reminders about 30 minutes before eligible events will be available/);
});

test('successful star confirms itinerary addition and unstar remains unchanged', () => {
  const handler = schedule.match(/const handleToggleFavorite[\s\S]*?^  \};/m)?.[0] || '';
  assert.match(handler, /toggleFavorite\(eventId\)/);
  assert.match(handler, /starSucceeded[\s\S]*setShowStarConfirmation\(true\)/);
  assert.match(schedule, /Added to Personal Itinerary/);
  assert.match(favorites, /isFavorite[\s\S]*removeFavorite\(sessionId\)[\s\S]*addFavorite\(sessionId\)/);
  assert.match(itinerary, /events\.filter\(\(event\) => favorites\.includes\(event\.id\)\)/);
});

test('contradictory post-star reminder offer is consolidated without notification changes', () => {
  assert.doesNotMatch(schedule, /showReminderPrompt|enableRemindersFromPrompt|Get event reminders/);
  assert.doesNotMatch(schedule, /shouldShowReminderPromotion|enableAttendeeItineraryReminders/);
  assert.match(worker, /"ITINERARY_REMINDER_DELIVERY_ENABLED", "false"/);
  assert.match(worker, /ITINERARY_REMINDER_SCHEDULER_ENABLED/);
  assert.match(wonderPush, /initializeWonderPush/);
});

test('Schedule filtering and category controls remain present', () => {
  assert.match(schedule, /showFavoritesOnly && !favorites\.includes\(event\.id\)/);
  assert.match(schedule, /getScheduleCategoryStyle/);
  assert.match(schedule, /categorySheetTitle/);
  assert.match(schedule, /selectedCategory === category/);
});
