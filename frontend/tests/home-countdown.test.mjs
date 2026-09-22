import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('countdown retains the real start date and ordinary pre-start units', () => {
  assert.match(home, /const EVENT_START_DATE = '2026-09-22T09:00:00'/);
  for (const label of ['IPM 2026 Starts In', 'Days', 'Hours', 'Minutes', 'Seconds']) {
    assert.ok(home.includes(`>${label}</Text>`));
  }
  assert.match(home, /setHasStarted\(difference <= 0\)/);
  assert.match(home, /clearInterval\(timer\)/);
});

test('temporary forced welcome is restricted to the exact staging web hostname', () => {
  assert.match(home, /Platform.OS === 'web' && typeof window !== 'undefined'\s*&& window.location.hostname === 'staging.theipm.ca'/);
  assert.match(home, /if \(forceWelcome \|\| hasStarted\)/);
  assert.match(home, /Welcome to the 2026 International Plowing Match &amp; Rural Expo!/);
});

test('welcome wraps without a line cap or fixed width and is centered', () => {
  const welcome = home.slice(home.indexOf('if (forceWelcome'), home.indexOf('const countdownStyles'));
  assert.doesNotMatch(welcome, /numberOfLines|ellipsizeMode/);
  const styles = home.slice(home.indexOf('  countdownWelcomeContainer: {'), home.indexOf('  countdownLabel: {'));
  assert.match(styles, /justifyContent: 'center'/);
  assert.match(styles, /textAlign: 'center'/);
  assert.doesNotMatch(styles, /width:|height:/);
});
