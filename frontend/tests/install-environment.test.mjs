import assert from 'node:assert/strict';
import test from 'node:test';
import { detectInstallEnvironment, detectStandaloneSignals, getInstallGuidance, INSTALL_DISMISS_COOLDOWN_MS, isInstallGuidanceEligible, shouldShowInstallGateway } from '../src/utils/installEnvironment.ts';

const detect = (userAgent, options = {}) => detectInstallEnvironment({ userAgent, ...options });
const iphoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const iphoneChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/128.0 Mobile/15E148 Safari/604.1';
const iphoneFirefox = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/128.0 Mobile/15E148 Safari/605.1.15';
const iphoneEdge = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 EdgiOS/128.0 Mobile/15E148 Safari/605.1.15';
const androidChrome = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36';
const samsung = 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S928W) AppleWebKit/537.36 Chrome/121.0 Mobile Safari/537.36 SamsungBrowser/25.0';

test('iPhone Safari receives visual Share and Add to Home Screen instructions', () => { const e = detect(iphoneSafari); const g = getInstallGuidance(e); assert.deepEqual([e.platform, e.browser], ['ios', 'safari']); assert.equal(g.steps[0].cue, 'share'); assert.match(g.steps[0].hint, /box with the arrow/i); assert.match(g.steps[1].title, /Add to Home Screen/); });
test('iPhone Chrome explains the Safari handoff and installation steps', () => { const g = getInstallGuidance(detect(iphoneChrome)); const copy = JSON.stringify(g); assert.match(g.intro, /not Chrome/i); assert.match(copy, /Open this page in Safari/); assert.match(copy, /Share button/); assert.match(copy, /Add to Home Screen/); });
test('iPhone Firefox explains the Safari handoff', () => { const g = getInstallGuidance(detect(iphoneFirefox)); assert.match(g.intro, /not Firefox/i); assert.equal(g.steps[0].cue, 'safari'); });
test('iPhone Edge explains the Safari handoff', () => { const g = getInstallGuidance(detect(iphoneEdge)); assert.match(g.intro, /not Edge/i); assert.equal(g.steps[0].cue, 'safari'); });
test('unknown iPhone browser uses the same Safari handoff', () => { const g = getInstallGuidance(detect('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 BrowserX/1.0 Mobile/15E148')); assert.match(g.intro, /not this browser/i); assert.match(JSON.stringify(g), /Safari/); });
test('Android Chrome with native prompt selects the easiest native action', () => { const e = detect(androidChrome, { nativePromptAvailable: true }); assert.equal(e.installState, 'install_prompt_available'); assert.equal(getInstallGuidance(e).primaryLabel, 'Install IPM App'); assert.equal(getInstallGuidance(e).steps.length, 0); });
test('Android Chrome without prompt receives current Chrome-specific fallback', () => { const g = getInstallGuidance(detect(androidChrome)); assert.equal(g.heading, 'Install the IPM App in Chrome'); assert.equal(g.steps[0].cue, 'more_vertical'); assert.match(g.steps[0].hint, /top-right/); assert.match(g.steps[1].title, /Add to Home screen/); assert.equal(g.primaryLabel, null); });
test('Samsung Internet is distinct and only broad family is used', () => { const e = detect(samsung); assert.equal(e.browser, 'samsung_internet'); assert.equal(e.deviceFamily, 'samsung'); assert.match(getInstallGuidance(e).heading, /Samsung/); });
test('other Android browser receives safe generic fallback', () => { const e = detect('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile BrowserX/1.0'); assert.equal(e.browser, 'other'); assert.match(getInstallGuidance(e).steps[2].hint, /Chrome/); });
test('desktop install-capable Chrome receives native action and explicit heading', () => { const e = detect('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36', { nativePromptAvailable: true }); const g = getInstallGuidance(e); assert.equal(e.platform, 'desktop'); assert.equal(g.heading, 'Install the IPM App in Chrome'); assert.equal(g.primaryLabel, 'Install IPM App'); });
test('desktop Chrome fallback uses current Cast save and share wording', () => { const g = getInstallGuidance(detect('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36')); assert.match(g.steps[1].title, /Cast, save, and share/); assert.match(g.steps[1].hint, /Install page as app/); });
test('desktop Edge gets Edge-specific Apps instructions', () => { const g = getInstallGuidance(detect('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36 Edg/128.0')); assert.equal(g.heading, 'Install the IPM App in Edge'); assert.match(g.steps[1].title, /More tools/); assert.match(g.steps[1].hint, /Install this site as an app/); });
test('standalone mode bypasses guidance', () => { const e = detect(androidChrome, { standalone: true, nativePromptAvailable: true }); assert.equal(e.installState, 'installed'); assert.equal(getInstallGuidance(e).heading, ''); });
test('unknown environment remains optional and non-blocking', () => { const e = detect(''); assert.equal(e.installState, 'unsupported_or_unknown'); assert.match(getInstallGuidance(e).intro, /use the app now/i); });
test('decline is respected during cooldown and eligible later', () => { const now = 10 * INSTALL_DISMISS_COOLDOWN_MS; assert.equal(isInstallGuidanceEligible(String(now - 1000), now), false); assert.equal(isInstallGuidanceEligible(String(now - INSTALL_DISMISS_COOLDOWN_MS), now), true); });

test('full-screen dismissal cooldown is 30 days', () => {
  assert.equal(INSTALL_DISMISS_COOLDOWN_MS, 30 * 24 * 60 * 60 * 1000);
});

test('all supported standalone signals bypass browser gating', () => {
  assert.equal(detectStandaloneSignals({ displayModeStandalone: true }), true);
  assert.equal(detectStandaloneSignals({ navigatorStandalone: true }), true);
  assert.equal(detectStandaloneSignals({ referrer: 'android-app://com.google.android.webapk' }), true);
  assert.equal(detectStandaloneSignals(), false);
});

const chromeEnvironment = detect(androidChrome, { nativePromptAvailable: true });
const gateway = (overrides = {}) => shouldShowInstallGateway({
  environment: chromeEnvironment,
  initialPath: '/',
  installedHint: false,
  returningVisitor: false,
  dismissedAt: null,
  now: Date.now(),
  storageReadable: true,
  ...overrides,
});

test('first ordinary browser visit remains eligible', () => {
  assert.equal(gateway(), true);
});

test('direct announcement, admin, preview and other non-home entries bypass the gateway', () => {
  for (const initialPath of ['/announcements/abc', '/admin', '/admin/login', '/preview-2026', '/schedule']) {
    assert.equal(gateway({ initialPath }), false);
  }
});

test('returning visitors, installed hints and storage failures fail open', () => {
  assert.equal(gateway({ returningVisitor: true }), false);
  assert.equal(gateway({ installedHint: true }), false);
  assert.equal(gateway({ storageReadable: false }), false);
});

test('unknown browsers and standalone environments never receive the gateway', () => {
  assert.equal(gateway({ environment: detect('') }), false);
  assert.equal(gateway({ environment: detect(androidChrome, { standalone: true }) }), false);
});

test('dismissal remains effective despite a newly available native prompt', () => {
  const now = Date.now();
  assert.equal(gateway({ dismissedAt: String(now - 1000), now }), false);
  assert.equal(gateway({ dismissedAt: String(now - INSTALL_DISMISS_COOLDOWN_MS), now }), true);
});
