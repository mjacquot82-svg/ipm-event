import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');

test('event detail header gives Star and close controls distinct 40px targets', () => {
  const star = source.match(/modalStarButton:\s*\{([\s\S]*?)\n\s*\},/);
  const close = source.match(/modalCloseButton:\s*\{([\s\S]*?)\n\s*\},/);
  assert.ok(star && close);
  assert.match(star[1], /width:\s*40/);
  assert.match(star[1], /height:\s*40/);
  assert.match(close[1], /width:\s*40/);
  assert.match(close[1], /height:\s*40/);
  assert.match(close[1], /marginLeft:\s*12/);
});

test('header controls retain separate handlers and accessible event content', () => {
  assert.match(source, /handleToggleFavorite\(selectedEvent\.id\)/);
  assert.match(source, /onPress=\{closeEventModal\}/);
  assert.match(source, /selectedEvent\.title/);
});
