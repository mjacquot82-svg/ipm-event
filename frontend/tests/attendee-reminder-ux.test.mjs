import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  isReminderPromotionEligible,
  mayShowReminderPromotion,
  MAX_REMINDER_PROMPT_SHOWS,
} from '../src/services/reminderUxPolicy.ts';

const schedule = await readFile(new URL('../app/(tabs)/schedule.tsx', import.meta.url), 'utf8');
const itinerary = await readFile(new URL('../app/(tabs)/itinerary.tsx', import.meta.url), 'utf8');
const ux = await readFile(new URL('../src/services/reminderUxService.web.ts', import.meta.url), 'utf8');
const sync = await readFile(new URL('../src/services/itineraryReminderSync.web.ts', import.meta.url), 'utf8');
const optIn = await readFile(new URL('../src/components/NotificationOptIn.tsx', import.meta.url), 'utf8');
const root = await readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8');

const baseOffer = { starSucceeded: true, becameFavorite: true, reminderReady: false,
  promptShows: 0, eventEligible: true };

test('promotion policy requires a successful eligible star and a not-ready device', () => {
  assert.equal(mayShowReminderPromotion(baseOffer), true);
  assert.equal(mayShowReminderPromotion({ ...baseOffer, starSucceeded: false }), false);
  assert.equal(mayShowReminderPromotion({ ...baseOffer, becameFavorite: false }), false);
  assert.equal(mayShowReminderPromotion({ ...baseOffer, reminderReady: true }), false);
  assert.equal(mayShowReminderPromotion({ ...baseOffer, eventEligible: false }), false);
});

test('no-nag policy permits exactly two local displays', () => {
  assert.equal(MAX_REMINDER_PROMPT_SHOWS, 2);
  assert.equal(mayShowReminderPromotion({ ...baseOffer, promptShows: 1 }), true);
  assert.equal(mayShowReminderPromotion({ ...baseOffer, promptShows: 2 }), false);
  assert.equal(mayShowReminderPromotion({ ...baseOffer, promptShows: 20 }), false);
});

test('started and late-star events are not promotion eligible', () => {
  const now = new Date('2026-09-22T14:00:00Z'); // 10:00 in Toronto.
  assert.equal(isReminderPromotionEligible({ start_date: '2026-09-22', start_time: '10:31 AM' }, now), true);
  assert.equal(isReminderPromotionEligible({ start_date: '2026-09-22', start_time: '10:30 AM' }, now), false);
  assert.equal(isReminderPromotionEligible({ start_date: '2026-09-22', start_time: '9:00 AM' }, now), false);
  assert.equal(isReminderPromotionEligible({ start_date: '2026-09-23', start_time: '9:00 AM' }, now), true);
});

test('pill is temporary, dismissible, accessible, and enablement requires its tap', () => {
  assert.match(schedule, /setTimeout\(\(\) => setShowReminderPrompt\(false\), 6000\)/);
  assert.match(schedule, /const starSucceeded = result\.isFavorite && result\.favorites\.includes\(eventId\)/);
  assert.match(schedule, /Dismiss event reminder offer/);
  assert.match(schedule, /accessibilityLabel="Get event reminders/);
  assert.match(schedule, /onPress=\{\(\) => void enableRemindersFromPrompt\(\)\}/);
  assert.doesNotMatch(schedule.slice(schedule.indexOf('handleToggleFavorite'), schedule.indexOf('enableRemindersFromPrompt')), /subscribeToNotifications/);
});

test('Android/default and granted paths subscribe then register and full-set sync only after action', () => {
  assert.match(ux, /getNotificationState\(\)/);
  assert.match(ux, /notificationState !== 'subscribed'.*subscribeToNotifications\(\)/s);
  assert.match(ux, /configureItineraryReminderSync\(await getFavorites\(\)\)/);
  assert.match(sync, /request\('\/register', 'POST'\)/);
  assert.match(sync, /request\('\/enabled', 'PUT', \{ enabled: true \}\)/);
  assert.match(sync, /request\('\/stars', 'PUT', \{ schedule_ids: completeSet \}\)/);
  assert.match(ux, /notificationState === 'denied'.*enabled: false/s);
});

test('iPhone browser requires Home Screen while standalone uses normal enablement', () => {
  assert.match(ux, /environment\.platform === 'ios' && environment\.installState !== 'installed'/);
  assert.match(ux, /notificationState: 'requires_install'/);
  assert.match(itinerary, /add IPM to your Home Screen/);
  assert.doesNotMatch(itinerary, /not supported in this browser/i);
  assert.match(optIn, /notifications are available from the installed IPM app/);
});

test('itinerary states are authoritative and disable preserves favorites', () => {
  for (const state of ["'checking'", "'on'", "'off'", "'blocked'", "'install_required'", "'recovery'"]) assert.match(itinerary, new RegExp(state));
  assert.match(itinerary, /result\.enabled && result\.readiness\?\.reminderReady/);
  assert.match(itinerary, /disableAttendeeItineraryReminders/);
  assert.match(sync, /request\('\/enabled', 'PUT', \{ enabled: false \}\)/);
  assert.doesNotMatch(sync, /unsubscribeFromNotifications|clearFavorites|removeFavorite/);
});

test('transient checks stay neutral while confirmed failures require recovery', () => {
  assert.match(ux, /notificationState === 'error'.*state: 'checking'/s);
  assert.match(ux, /authoritative_verification_temporarily_unavailable/);
  assert.match(ux, /readiness\.reminderReady.*state: 'on'/s);
  assert.match(ux, /state: registrationExists \? 'recovery'/);
  assert.match(itinerary, /Checking event reminders/);
  assert.match(itinerary, /Reconnect event reminders/);
  assert.match(itinerary, /Notifications are blocked/);
});

test('attendee diagnostics are redacted readiness facts only', () => {
  for (const field of ['supported_context', 'browser_permission_granted', 'sdk_ready',
    'subscribed', 'current_installation_available', 'registration_exists',
    'installation_match', 'reminders_enabled', 'local_reminder_sync_enabled', 'synchronized_star_count',
    'provider_reachability', 'provider_deliverable', 'provider_checked_at',
    'provider_fresh', 'final_reminder_ready']) assert.match(ux, new RegExp(field));
  const diagnostics = ux.slice(ux.indexOf('const redacted ='), ux.indexOf('if (readiness.reminderReady)'));
  assert.doesNotMatch(diagnostics, /installation_id|capability|push_token|credential/i);
});

test('staging diagnostic expander renders only the existing redacted snapshot', () => {
  assert.match(itinerary, /const IS_STAGING = .*includes\('staging'\)/);
  assert.match(itinerary, /\{IS_STAGING \? \(/);
  assert.match(itinerary, /Show reminder diagnostics/);
  assert.match(itinerary, /onPress=\{\(\) => setShowReminderDiagnostics\(\(visible\) => !visible\)\}/);
  assert.match(itinerary, /Redacted reminder diagnostics/);
  const expander = itinerary.slice(itinerary.indexOf('{IS_STAGING ? ('), itinerary.indexOf('{starredEvents.length > 0'));
  assert.doesNotMatch(expander, /getAttendeeReminderStatus|configureItineraryReminderSync|subscribeToNotifications|fetch\(|request\(|\/register|\/enabled|\/stars|\/deliveries/);
  assert.doesNotMatch(expander, /installation ID|capability|push token|API credential|raw provider/i);
});

test('narrow-mobile diagnostics scroll independently and copy only the redacted report', () => {
  assert.match(itinerary, /<ScrollView[\s\S]*nestedScrollEnabled[\s\S]*persistentScrollbar/);
  assert.match(itinerary, /reminderDiagnosticsPanel: \{ maxHeight: 280/);
  assert.match(itinerary, /Copy reminder diagnostics/);
  assert.match(itinerary, /navigator\.clipboard\.writeText\(diagnosticReport\)/);
  const copyHandler = itinerary.slice(itinerary.indexOf('const copyReminderDiagnostics'),
    itinerary.indexOf('const handleRemove'));
  assert.match(copyHandler, /diagnosticRows[\s\S]*\.map\([\s\S]*\.join\('\\n'\)/);
  assert.doesNotMatch(copyHandler, /fetch\(|request\(|subscribe|register|enable|reconnect|deliver/);
  assert.doesNotMatch(copyHandler, /installation_id|capability|push_token|credential|raw provider/i);
  assert.doesNotMatch(itinerary.slice(itinerary.indexOf('const diagnosticRows'),
    itinerary.indexOf('const copyReminderDiagnostics')), /provider_checked_at|installation_id|capability|push_token|credential/i);
});

test('full-set reconciliation is used for star and unstar without breaking local favorites', () => {
  assert.match(schedule, /syncStarredEventsWithBackend\(result\.favorites\)/);
  assert.match(itinerary, /syncStarredEventsWithBackend\(result\.favorites\)/);
  assert.match(sync, /schedule_ids: \[\.\.\.new Set\(starredScheduleIds\)\]/);
  assert.match(sync, /Local favorites remain authoritative for UX/);
});

test('refresh-race recovery verifies readiness and preserves full-set reconciliation', () => {
  assert.match(ux, /notificationState !== 'subscribed' && readiness\.client\.clientReady/);
  assert.match(ux, /getItineraryReminderReadiness\(\{ verifyProvider: true \}\)/);
  assert.match(sync, /schedule_ids: \[\.\.\.new Set\(starredScheduleIds\)\]/);
  assert.match(sync, /Local favorites remain authoritative for UX/);
  assert.doesNotMatch(ux, /Notification\.requestPermission/);
  const statusFlow = ux.slice(ux.indexOf('export async function getAttendeeReminderStatus'),
    ux.indexOf('export async function shouldShowReminderPromotion'));
  assert.doesNotMatch(statusFlow, /subscribeToNotifications\(/);
});

test('installation diagnostics distinguish unknown, mismatch, and subscription failure', () => {
  assert.match(sync, /getCurrentInstallationFingerprint/);
  assert.match(sync, /existing\.registration_fingerprint === currentFingerprint \? 'match' : 'mismatch'/);
  assert.match(sync, /currentInstallationMatch === 'mismatch' \? 'installation_mismatch'/);
  assert.match(sync, /client\.subscription !== 'subscribed' \? 'wonderpush_subscription'/);
  assert.match(ux, /currentInstallationMatch === 'unavailable'[\s\S]*\? null/);
});

test('deliberate reconnect replaces association then preserves full local star set without sending', () => {
  const configure = sync.slice(sync.indexOf('export async function configureItineraryReminderSync'),
    sync.indexOf('export async function enableItineraryRemindersForTesting'));
  assert.ok(configure.indexOf("request('/register', 'POST')") < configure.indexOf("request('/enabled', 'PUT'"));
  assert.ok(configure.indexOf("request('/enabled', 'PUT'") < configure.indexOf("request('/stars', 'PUT'"));
  assert.match(configure, /const completeSet = \[\.\.\.new Set\(starredScheduleIds\)\]/);
  assert.doesNotMatch(configure, /\/deliveries|send_installations|send_everyone|send_one_installation/);
});

test('attendee UI exposes no diagnostic identifiers or staging device link', () => {
  const attendee = `${schedule}\n${itinerary}\n${optIn}`;
  for (const forbidden of ['WonderPush installation', 'capability credential', 'Device A', 'Device B', 'verification code', 'Device test']) {
    assert.doesNotMatch(attendee, new RegExp(forbidden, 'i'));
  }
  assert.doesNotMatch(optIn, /reminder-test-registration/);
  assert.match(root, /reminder-test-registration/); // Engineering route remains isolated and unlinked.
});

test('enablement and starring contain no notification delivery operation', () => {
  const attendeeFlow = `${ux}\n${sync}\n${schedule}`;
  assert.doesNotMatch(attendeeFlow, /send_everyone|send_installations|targetSegmentIds|controlled-device-a-send|\/deliveries/);
});
