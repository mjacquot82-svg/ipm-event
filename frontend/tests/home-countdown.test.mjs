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

test('completion depends only on the real clock, without staging overrides', () => {
  assert.doesNotMatch(home, /forceWelcome|staging.theipm.ca|previewWelcome/);
  assert.match(home, /if \(hasStarted\)/);
  assert.match(home, /The countdown is over! Welcome to the 2026 International Plowing Match &amp; Rural Expo!/);
});

test('welcome wraps without a line cap or fixed width and is centered', () => {
  const welcome = home.slice(home.indexOf('if (hasStarted'), home.indexOf('const countdownStyles'));
  assert.doesNotMatch(welcome, /numberOfLines|ellipsizeMode/);
  const styles = home.slice(home.indexOf('  countdownWelcomeContainer: {'), home.indexOf('  countdownLabel: {'));
  assert.match(styles, /justifyContent: 'center'/);
  assert.match(styles, /textAlign: 'center'/);
  assert.doesNotMatch(styles, /width:|height:/);
});

test('clock is only rendered in the ordinary pre-start countdown', () => {
  const start = home.indexOf('if (hasStarted)');
  const normal = home.indexOf('  return (\n    <>', start);
  assert.doesNotMatch(home.slice(start, normal), /countdownIcon|name="clock"/);
  assert.match(home.slice(normal, home.indexOf('const countdownStyles')), /testID="countdown-clock"/);
  assert.match(home, /countdownWelcomeContainer: \{\s*flex: 1/);
});
