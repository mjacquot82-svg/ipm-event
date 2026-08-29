import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const publicIndex = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const rootLayout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
const tabLayout = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
const webpushrWorker = readFileSync(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8');

test('keeps the production Webpushr SDK, setup, and service worker', () => {
  assert.match(publicIndex, /https:\/\/cdn\.webpushr\.com\/app\.min\.js/);
  assert.match(publicIndex, /webpushr\('setup'/);
  assert.match(rootLayout, /https:\/\/cdn\.webpushr\.com\/app\.min\.js/);
  assert.match(rootLayout, /window\.webpushr\('setup'/);
  assert.match(webpushrWorker, /https:\/\/cdn\.webpushr\.com\/sw-server\.min\.js/);
});

test('removes the Webpushr bell from layout and hit testing only', () => {
  assert.match(
    publicIndex,
    /#webpushr-bell-optin\s*\{[^}]*display:\s*none\s*!important;[^}]*pointer-events:\s*none\s*!important;/s,
  );
  assert.doesNotMatch(publicIndex, /#webpushr-prompt-wrapper/);
});

test('keeps all four bottom-navigation touch targets unobstructed', () => {
  for (const routeName of ['index', 'map', 'schedule', 'about']) {
    assert.match(tabLayout, new RegExp(`<TabItem routeName=["']${routeName}["']\\s*/>`));
  }
  assert.match(tabLayout, /tabItem:\s*\{\s*flex:\s*1,/);
});

test('does not promote WonderPush or staging-only attendee features', () => {
  const productionSurface = `${publicIndex}\n${rootLayout}\n${tabLayout}`;
  assert.doesNotMatch(
    productionSurface,
    /WonderPush|NotificationOptIn|StagingOfflineStatus|plowing-results|reminder-test-registration/i,
  );
});
