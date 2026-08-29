import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const detail = await readFile(new URL('../app/announcements/[announcement_id].tsx', import.meta.url), 'utf8');
const rootLayout = await readFile(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const deepLinks = await readFile(new URL('../src/services/notificationDeepLinkCore.ts', import.meta.url), 'utf8');

test('announcement detail consumes the real top safe-area inset', () => {
  assert.match(rootLayout, /<SafeAreaProvider>/);
  assert.match(detail, /<SafeAreaView style=\{styles\.container\} edges=\{\['top'\]\}>/);
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(detail, /paddingTop:\s*(?:4[4-9]|[5-9]\d|\d{3,})/);
});

test('header stays readable and its Back control has an accessible touch target', () => {
  assert.match(detail, /backButton: \{[^}]*flexShrink: 0[^}]*minHeight: 44[^}]*minWidth: 44/);
  assert.match(detail, /headerText: \{ flex: 1, minWidth: 0 \}/);
  assert.match(detail, /accessibilityRole="button"/);
  assert.match(detail, /accessibilityLabel="Back to announcements"/);
  assert.match(detail, /accessibilityRole="header"/);
});

test('known in-app entries use history and direct entries fall back to Announcements', () => {
  assert.match(detail, /if \(source && router\.canGoBack\(\)\) router\.back\(\)/);
  assert.match(detail, /else router\.replace\('\/announcements' as never\)/);
});

test('announcement notification deep-link destination remains the detail route', () => {
  assert.match(deepLinks, /ANNOUNCEMENT_DETAIL_PATH = \/\^\\\/announcements\\\//);
  assert.match(deepLinks, /return target\.pathname/);
});

test('safe-area layout remains platform-responsive without device-specific offsets', () => {
  assert.doesNotMatch(detail, /Platform\.OS|iPhone|Android|Dynamic Island/);
  assert.match(detail, /useAttendeeLayout\(\)/);
  assert.match(detail, /frameStyle/);
  assert.match(detail, /sectionStyle/);
});
