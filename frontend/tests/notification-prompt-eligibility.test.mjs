import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  getTorontoCalendarDay,
  isNotificationPromptEligible,
  nextNotificationPromptDailyState,
  NOTIFICATION_PROMPT_COOLDOWN_MS,
  NOTIFICATION_PROMPT_DAILY_LIMIT,
} from '../src/utils/notificationPromptEligibility.ts';

const component = await readFile(new URL('../src/components/NotificationOptIn.tsx', import.meta.url), 'utf8');

test('optional notification prompt uses a four-hour cooldown', () => {
  const now = Date.parse('2026-09-22T15:00:00Z');
  assert.equal(NOTIFICATION_PROMPT_COOLDOWN_MS, 4 * 60 * 60 * 1000);
  assert.equal(isNotificationPromptEligible({ now, dismissedAt: String(now - NOTIFICATION_PROMPT_COOLDOWN_MS + 1), dailyState: null }), false);
  assert.equal(isNotificationPromptEligible({ now, dismissedAt: String(now - NOTIFICATION_PROMPT_COOLDOWN_MS), dailyState: null }), true);
});

test('America/Toronto calendar day limits prompts to two and resets next day', () => {
  const late = Date.parse('2026-09-23T03:30:00Z');
  const next = Date.parse('2026-09-23T04:30:00Z');
  assert.equal(getTorontoCalendarDay(late), '2026-09-22');
  assert.equal(getTorontoCalendarDay(next), '2026-09-23');
  assert.equal(NOTIFICATION_PROMPT_DAILY_LIMIT, 2);
  assert.equal(isNotificationPromptEligible({ now: late, dismissedAt: null, dailyState: { day: '2026-09-22', count: 2 } }), false);
  assert.equal(isNotificationPromptEligible({ now: next, dismissedAt: null, dailyState: { day: '2026-09-22', count: 2 } }), true);
  assert.deepEqual(nextNotificationPromptDailyState(next, { day: '2026-09-22', count: 2 }), { day: '2026-09-23', count: 1 });
});

test('Not now is local-only and cannot request permission, subscribe, or register', () => {
  const dismissStart = component.indexOf('const dismissOptionalPrompt');
  const dismissEnd = component.indexOf('}, []);', dismissStart);
  const dismiss = component.slice(dismissStart, dismissEnd);
  assert.match(dismiss, /NOTIFICATION_PROMPT_DISMISSED_AT_KEY/);
  assert.match(dismiss, /AsyncStorage\.setItem/);
  assert.doesNotMatch(dismiss, /requestPermission|subscribeToNotifications|ensureNotificationRegistration|fetch\(/);
  assert.match(component, /<Text style=\{styles\.notNowButtonText\}>Not now<\/Text>/);
});

test('frequency is recorded only after rendering and no cooldown timer interrupts later', () => {
  assert.match(component, /useEffect\(\(\) => \{\s*if \(!optionalPromptVisible/);
  assert.match(component, /nextNotificationPromptDailyState/);
  assert.doesNotMatch(component, /setTimeout\([\s\S]*NOTIFICATION_PROMPT_COOLDOWN_MS/);
});

test('a visible unsubscribed card stays latched through later canonical status checks', () => {
  assert.match(component, /nextState === 'unsubscribed' && disabledPromptLatchedRef\.current[\s\S]*setOptionalPromptVisible\(true\)/);
  assert.match(component, /nextState === 'unsubscribed' && eligible[\s\S]*disabledPromptLatchedRef\.current = true/);
  assert.match(component, /useFocusEffect\([\s\S]*void refresh\(\);[\s\S]*\}, \[refresh\]\)/);
  assert.doesNotMatch(component, /getNotificationState\(\)\s*\.then\(evaluateOptionalPrompt\)/);
});

test('local subscription state stays visible until provider-backed setup is ready', () => {
  assert.match(component, /await ensureNotificationRegistration\(\);[\s\S]*setSetupState\('ready'\)/);
  assert.match(component, /state === 'subscribed' && setupState === 'ready'/);
  assert.doesNotMatch(component, /state === 'subscribed' && setupState !== 'failed'/);
});

test('healthy, denied, unsupported, failed, and offline states stay outside optional eligibility', () => {
  assert.match(component, /nextState !== 'default' && nextState !== 'unsubscribed'/);
  assert.match(component, /nextState === 'subscribed'/);
  assert.match(component, /state === 'denied'/);
  assert.match(component, /state === 'unsupported' && isIphoneSafari/);
  assert.match(component, /state === 'subscribed' && setupState === 'failed'/);
  assert.match(component, /navigator\.onLine === false/);
});
