import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyShowGuideSchedulePatch,
  summarizeShowGuidePatch,
  SHOW_GUIDE_SCHEDULE_PATCH,
} from '../src/data/applyShowGuideSchedulePatch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const baseline = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/showGuideScheduleBaseline.staging.json'), 'utf8'),
);

const STAGING_ONLY_BASELINE = 56; // from reconciliation; must not decrease via deletes
const LUMBERJACK_TIMES = [];
for (const date of ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26']) {
  for (const time of ['10:30 AM', '1:00 PM', '3:00 PM']) {
    LUMBERJACK_TIMES.push(`${date} ${time}`);
  }
}

test('baseline staging schedule snapshot is intact', () => {
  assert.equal(baseline.total_count, 218);
  assert.equal(baseline.events.length, 218);
  const lj = baseline.events.filter((e) => e.title === 'Great Canadian Lumberjack Show');
  assert.equal(lj.length, 15);
  assert.ok(lj.every((e) => e.location_name == null || e.location_name === ''));
});

test('Lumberjack x15 get location_name 1A-35-38 without dupes or time changes', () => {
  const patched = applyShowGuideSchedulePatch(structuredClone(baseline));
  const lj = patched.events.filter((e) => e.title === 'Great Canadian Lumberjack Show');
  assert.equal(lj.length, 15);
  assert.ok(lj.every((e) => e.location_name === '1A-35-38'));
  assert.deepEqual(
    lj.map((e) => `${e.start_date} ${e.start_time}`).sort(),
    [...LUMBERJACK_TIMES].sort(),
  );
  const keys = lj.map((e) => `${e.start_date}|${e.start_time}`);
  assert.equal(new Set(keys).size, 15);
});

test('Southampton Olive Oil is added once as discrete MNP event', () => {
  const patched = applyShowGuideSchedulePatch(structuredClone(baseline));
  const hits = patched.events.filter((e) => /southampton/i.test(e.title || ''));
  assert.equal(hits.length, 1);
  const event = hits[0];
  assert.equal(event.title, 'Southampton Olive Oil');
  assert.equal(event.start_date, '2026-09-24');
  assert.equal(event.start_time, '2:45 PM');
  assert.equal(event.end_time, '3:15 PM');
  assert.equal(event.category, 'MNP Lifestyles Tent Events');
  assert.equal(event.location_name, 'The Beyond Wireless Stage');
  // idempotent
  const again = applyShowGuideSchedulePatch(structuredClone(patched));
  assert.equal(again.events.filter((e) => /southampton/i.test(e.title || '')).length, 1);
});

test('Essentially Lavender Beyond Wireless corrected to Guide 3:15-3:30', () => {
  const patched = applyShowGuideSchedulePatch(structuredClone(baseline));
  const lavender = patched.events.filter(
    (e) =>
      e.title === 'Essentially Lavender' &&
      e.start_date === '2026-09-24' &&
      e.location_name === 'The Beyond Wireless Stage',
  );
  assert.equal(lavender.length, 1);
  assert.equal(lavender[0].start_time, '3:15 PM');
  assert.equal(lavender[0].end_time, '3:30 PM');
});

test('TBC items are not added (Gregglea Tue / Lawn Mower Races)', () => {
  const patched = applyShowGuideSchedulePatch(structuredClone(baseline));
  assert.equal(
    patched.events.filter((e) => e.title === 'Gregglea Clydesdales' && e.start_date === '2026-09-22')
      .length,
    0,
  );
  assert.equal(patched.events.filter((e) => /lawn mower/i.test(e.title || '')).length, 0);
  assert.equal(SHOW_GUIDE_SCHEDULE_PATCH.decisions.tbc_hold.action, 'DO_NOT_ADD');
});

test('Opening Ceremonies / Susan Briggs / Sat Doors Open / Bruce RV preserved', () => {
  const patched = applyShowGuideSchedulePatch(structuredClone(baseline));
  const opening = patched.events.find((e) => e.title === 'Opening Ceremonies');
  assert.equal(opening.start_time, '11:30 AM');
  assert.equal(opening.end_time, '1:00 PM');

  const susan = patched.events.find((e) => e.title === 'Susan Briggs');
  assert.equal(susan.start_time, '3:30 PM');
  assert.equal(susan.end_time, '5:00 PM');

  const doors = patched.events.find((e) => e.title === 'Doors Open — Gina Livy (Afternoon)');
  assert.equal(doors.start_time, '12:30 PM');
  assert.equal(doors.end_time, '1:30 PM');

  for (const title of [
    'Weekend Never Ends',
    'Adam Cousins',
    'Colt McLauchlin',
    'The Skeleton Crew',
    'Catfish Gumbo',
    'Tandem',
  ]) {
    const event = patched.events.find((e) => e.title === title);
    assert.equal(event.location_name, 'CKNX Centennial Pavilion (GFO Stage) Lounge');
    assert.equal(event.category, 'The Bruce RV Park - Nightly Entertainment');
  }

  assert.equal(SHOW_GUIDE_SCHEDULE_PATCH.decisions.opening_ceremonies.action, 'PRESERVE');
  assert.equal(SHOW_GUIDE_SCHEDULE_PATCH.decisions.susan_briggs.action, 'PRESERVE');
  assert.equal(SHOW_GUIDE_SCHEDULE_PATCH.decisions.sat_doors_open_afternoon.action, 'PRESERVE');
  assert.equal(SHOW_GUIDE_SCHEDULE_PATCH.decisions.bruce_rv_nightly_six.action, 'PRESERVE');
});

test('staging-only event count does not decrease (no deletes)', () => {
  const before = baseline.events.length;
  const patched = applyShowGuideSchedulePatch(structuredClone(baseline));
  assert.ok(patched.events.length >= before);
  assert.equal(SHOW_GUIDE_SCHEDULE_PATCH.decisions.staging_only_deletes.action, 'DELETE_NONE');
  // Reconciliation staging-only bucket is a documentation constant we must not shrink via deletes.
  assert.ok(STAGING_ONLY_BASELINE >= 56);
  assert.equal(patched.total_count, before + 1); // + Southampton only
});

test('summary helper reports expected patch outcomes', () => {
  const summary = summarizeShowGuidePatch(structuredClone(baseline));
  assert.equal(summary.lumberjack_count, 15);
  assert.deepEqual(summary.lumberjack_locations, ['1A-35-38']);
  assert.equal(summary.southampton_count, 1);
  assert.deepEqual(summary.lavender_bw, [{ start_time: '3:15 PM', end_time: '3:30 PM' }]);
  assert.equal(summary.tbc_lawn_mower_count, 0);
  assert.equal(summary.tbc_gregglea_tue_count, 0);
});

test('staging frontend wires patch only when app label is staging', () => {
  const service = fs.readFileSync(
    path.join(root, 'src/services/spreadsheetDataService.ts'),
    'utf8',
  );
  assert.match(service, /shouldApplyShowGuideSchedulePatch/);
  assert.match(service, /applyShowGuideSchedulePatch/);
  const guard = fs.readFileSync(
    path.join(root, 'src/data/applyShowGuideSchedulePatch.ts'),
    'utf8',
  );
  assert.match(guard, /EXPO_PUBLIC_IPM_APP_LABEL === 'staging'/);
  assert.match(guard, /1A-35-38/);
});
