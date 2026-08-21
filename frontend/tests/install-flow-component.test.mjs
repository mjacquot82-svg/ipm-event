import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/PWAInstallPrompt.tsx', import.meta.url), 'utf8');

test('component preserves deferred native prompt and invokes it from the install action', () => {
  assert.match(source, /window\.deferredPWAPrompt/);
  assert.match(source, /await prompt\.prompt\(\)/);
  assert.match(source, /await prompt\.userChoice/);
});

test('component preserves standalone bypass, appinstalled handling, and dismissal storage', () => {
  assert.match(source, /display-mode: standalone/);
  assert.match(source, /addEventListener\('appinstalled'/);
  assert.match(source, /AsyncStorage\.setItem\(DISMISS_KEY/);
});

test('component keeps an accessible optional continuation and labelled instructional cues', () => {
  assert.match(source, /accessibilityLabel="Continue without installing"/);
  assert.match(source, /Maybe later — continue to the app/);
  assert.match(source, /accessibilityLabel=\{label\}/);
});
