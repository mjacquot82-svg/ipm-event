import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../src/components/PWAInstallPrompt.tsx', import.meta.url), 'utf8');
const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const appStatus = await readFile(new URL('../src/components/AppStatus.tsx', import.meta.url), 'utf8');

test('diagnostic mode is staging-host and query gated', () => {
  assert.match(component, /host === 'staging\.theipm\.ca'/);
  assert.match(component, /installDebug.*=== '1'/);
  assert.doesNotMatch(component, /installDebug.*production/);
});

test('diagnostic reports the same install decision inputs', () => {
  for (const label of ['ROUTE', 'IS HOME', 'COMPONENT MOUNTED', 'PLATFORM', 'BROWSER', 'MOBILE', 'DISPLAY-MODE STANDALONE', 'NAVIGATOR.STANDALONE', 'BEFOREINSTALLPROMPT CAPTURED', 'STORAGE READ STATUS', 'DISMISSAL VALUE', 'SESSION FALLBACK VALUE', 'INSTALL GUIDE ELIGIBLE', 'RENDER REQUESTED', 'SUPPRESSION REASON']) assert.match(component, new RegExp(label));
  assert.match(component, /shouldOfferInstallGuidance/);
});

test('diagnostic can mount even when pathname check disagrees', () => {
  assert.match(home, /homeFocused \|\| isInstallDebugMode\(\)/);
});

test('diagnostic snapshot is also exposed in the existing staging App Status surface', () => {
  assert.match(appStatus, /ipm-install-diagnostic/);
  assert.match(appStatus, /Install guidance diagnostic/);
  assert.match(appStatus, /COMPONENT MOUNTED/);
});
