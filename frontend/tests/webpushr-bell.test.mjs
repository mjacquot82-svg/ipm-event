import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const publicIndex = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const rootLayout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
const tabLayout = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
const webpushrWorker = readFileSync(new URL('../public/webpushr-sw.js', import.meta.url), 'utf8');

test('keeps the rollback bell guard while active ownership switches providers', () => {
  assert.doesNotMatch(publicIndex, /https:\/\/cdn\.webpushr\.com\/app\.min\.js/);
  assert.doesNotMatch(rootLayout, /window\.webpushr/);
  assert.doesNotMatch(webpushrWorker, /cdn\.webpushr\.com/);
  assert.match(webpushrWorker, /cdn\.by\.wonderpush\.com/);
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

test('does not promote staging-only attendee features', () => {
  const productionSurface = `${publicIndex}\n${rootLayout}\n${tabLayout}`;
  assert.doesNotMatch(
    productionSurface,
    /StagingOfflineStatus|plowing-results|reminder-test-registration/i,
  );
});
