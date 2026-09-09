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
  assert.match(source, /Close help — keep using IPM/);
  assert.match(source, /accessibilityLabel=\{label\}/);
});

const layout = await readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
test('R deep-linked first visits retain the route without a global installation overlay', () => {
 assert.doesNotMatch(layout, /<PWAInstallPrompt/);
 assert.match(layout, /startInstallPromptCapture/);
 assert.doesNotMatch(source, /router\.replace|router\.push|location\.href/);
 assert.doesNotMatch(source, /absoluteFillObject|isInstallGuidanceEligible/);
});
