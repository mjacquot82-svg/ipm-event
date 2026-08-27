import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const attendee = read('../app/(tabs)/plowing-results.tsx');
const home = read('../app/(tabs)/index.tsx');
const admin = read('../app/admin/plowing-results.tsx');
const adminService = read('../src/services/adminAuthService.ts');
const publicService = read('../src/services/plowingResultsService.ts');
const backend = read('../../backend/server.py');
const seed = read('../../backend/plowing_results_demo.py');

test('staging attendee route is a mobile ranked results experience', () => {
  assert.match(attendee, /DEMO RESULTS/);
  assert.match(attendee, /Sample standings for demonstration purposes only/);
  assert.match(attendee, /Class/);
  assert.match(attendee, /Group/);
  assert.match(attendee, /Standings/);
  assert.match(attendee, /Daily Results/);
  assert.match(attendee, /POSITION/);
  assert.match(attendee, /topResult/);
  assert.match(attendee, /Last updated:/);
  assert.match(attendee, /Provisional|selectedGroup\.status/);
  assert.match(attendee, /setInterval\(\(\) => void load\(\), 15000\)/);
  assert.doesNotMatch(attendee, /<table|DataTable/);
});

test('demo remains available by direct route but has no Home entry point', () => {
  assert.match(attendee, /DEMO RESULTS/);
  assert.match(attendee, /getPlowingResults/);
  assert.doesNotMatch(home, /SHOW_PLOWING_RESULTS_DEMO|router\.push\('\/plowing-results'|>Plowing Results<|Open Plowing Results demo/);
});

test('organizer manager uses auth, local draft edits, validation, publish and confirmed reset', () => {
  assert.match(admin, /getCurrentOrganizer/);
  assert.match(admin, /user\.role === 'Owner' \|\| user\.role === 'Schedule'/);
  assert.match(admin, /Every competitor needs a name/);
  assert.match(admin, /points between 0 and 1,000/);
  assert.match(admin, /Publish Results/);
  assert.match(admin, /Results published successfully/);
  assert.match(admin, /window\.confirm|Alert\.alert/);
  assert.match(admin, /Reset Demo Results/);
  assert.match(admin, /useWindowDimensions/);
  assert.match(admin, /width >= 760/);
});

test('shared persistence is staging-gated and isolated from core datasets', () => {
  assert.match(backend, /if not IS_STAGING_DEPLOYMENT:[\s\S]*status_code=404/);
  assert.match(backend, /database\.plowing_results_demo/);
  assert.match(backend, /@api_router\.put\("\/admin\/plowing-results"\)/);
  assert.match(backend, /@api_router\.post\("\/admin\/plowing-results\/reset"\)/);
  assert.match(adminService, /credentials: 'include'/);
  assert.match(adminService, /publishAdminPlowingResults/);
  assert.match(publicService, /ipm_plowing_results_demo_cache_v1/);
  assert.match(publicService, /event_id !== 'ipm-2026-demo'/);
  assert.doesNotMatch(seed, /schedule|vendor|reminder|notification/i);
});

test('synthetic seed provides all demo classes, groups, daily scores and statuses', () => {
  assert.match(seed, /"Class 2"/);
  assert.match(seed, /"Class 5"/);
  assert.match(seed, /"Class 6"/);
  assert.match(seed, /DAYS = \("Tue", "Wed", "Thu", "Fri"\)/);
  assert.match(seed, /"In Progress"/);
  assert.match(seed, /"Provisional"/);
  assert.match(seed, /"Final"/);
  assert.match(seed, /ipm-2026-demo/);
});
