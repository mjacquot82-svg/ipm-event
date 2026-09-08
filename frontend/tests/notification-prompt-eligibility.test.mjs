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

test('notification help never uses the retired recurring prompt policy', () => {
 assert.doesNotMatch(component, /isNotificationPromptEligible|nextNotificationPromptDailyState|setTimeout|setInterval/);
 assert.match(component, /const \[expanded, setExpanded\] = useState\(initiallyExpanded\)/);
 assert.match(component, /initiallyExpanded = false/);
 assert.match(component, /Notification options/);
});
test('notification success stays visible and controls remain discoverable', () => {
 assert.match(component, /Notifications are enabled on this device/);
 assert.doesNotMatch(component, /if \(state === 'subscribed'.*return null/);
});
