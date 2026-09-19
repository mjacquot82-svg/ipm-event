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
  assert.match(source, /Continue using the website/);
  assert.match(source, /accessibilityLabel=\{label\}/);
});

const layout = await readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
test('deep links retain their route; Home alone owns automatic guidance', () => {
 assert.doesNotMatch(layout, /<PWAInstallPrompt/);
 assert.match(layout, /startInstallPromptCapture/);
 assert.doesNotMatch(source, /router\.replace|router\.push|location\.href/);
 assert.doesNotMatch(source, /absoluteFillObject|isInstallGuidanceEligible/);
});

const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const about = await readFile(new URL('../app/(tabs)/about.tsx', import.meta.url), 'utf8');
test('Home-only focused mounting prevents contextual tutorial collision', () => {
 assert.match(home, /homeFocused && <PWAInstallPrompt automatic/);
 assert.match(home, /usePathname/);
 assert.match(about, /<PWAInstallPrompt \/>/);
 assert.ok(about.indexOf('<PWAInstallPrompt />') < about.indexOf('{appHelp ? <>'));
});
test('install flow writes only its own preferences and holds updater interactions', () => {
 assert.doesNotMatch(source, /removeItem|clear\(|favorites|notificationRegistration|subscribeToNotifications|Notification\.requestPermission/);
 assert.match(source, /holdPwaUpdate/);
 assert.match(source, /ENTRY_COMPLETED_KEY/);
 assert.match(source, /onRequestClose/);
 assert.match(source, /SafeAreaView/);
});
