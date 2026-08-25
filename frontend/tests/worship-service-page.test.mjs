import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../app/(tabs)/worship-service.tsx', import.meta.url), 'utf8');
const layout = await readFile(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
const destinations = await readFile(new URL('../src/analytics/trackedLinks.ts', import.meta.url), 'utf8');
const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('Worship Service route is registered and hidden from bottom tabs', () => {
  assert.match(layout, /name="worship-service" options={{ title: 'Interdenominational Worship Service', href: null }}/);
});

test('artwork uses production assets in the reviewed order', () => {
  const cross = page.indexOf("worship-service-cross.jpg");
  const join = page.indexOf("worship-service-join-us.jpg");
  assert.ok(cross >= 0);
  assert.ok(join > cross);
  assert.match(page, /const ARTWORK_ASPECT_RATIO = 1365 \/ 1706/);
  assert.match(page, /resizeMode="contain"/);
});

test('artwork is a continuous responsive stack without an intentional gap', () => {
  assert.match(page, /scrollContent: { paddingHorizontal: 0, paddingTop: 12 }/);
  assert.match(page, /content: { width: '100%', alignItems: 'center' }/);
  assert.match(page, /artwork: { width: '100%', maxWidth: 720, alignSelf: 'center', overflow: 'hidden', margin: 0, padding: 0 }/);
  assert.match(page, /posterImage: { width: '100%', aspectRatio: ARTWORK_ASPECT_RATIO, alignSelf: 'stretch', flexShrink: 0, margin: 0, padding: 0 }/);
  assert.doesNotMatch(page, /posterImage:[^\n]*(gap|marginBottom|marginTop|border|borderRadius)/);
  assert.doesNotMatch(page, /(?:artwork|posterImage):[^\n]*(?:height|minHeight|maxHeight):/);
  assert.doesNotMatch(page, /useAttendeeLayout|sectionStyle/);
});

test('original PDF action uses the exact tracked external destination', () => {
  assert.match(page, /openTrackedLink\('worship_service_pdf', 'worship_service'\)/);
  assert.match(page, />View Original PDF<\/Text>/);
  assert.match(destinations, /worship_service_pdf: \{[^\n]*url: 'https:\/\/www\.plowingmatch\.org\/ipm2026\/wp-content\/uploads\/2026\/03\/IPM-2026-Worship-Service\.pdf'/);
});

test('page provides accessible artwork labels and safe Back navigation', () => {
  assert.equal((page.match(/accessibilityLabel="[^"]+"/g) || []).length >= 4, true);
  assert.match(page, /if \(router\.canGoBack\(\)\) router\.back\(\)/);
  assert.match(page, /else router\.replace\('\/'\)/);
});

test('candidate introduces no notification or reminder integration', () => {
  const candidate = [page, layout, home, destinations].join('\n');
  const prohibited = ['wonder' + 'push', 'web' + 'pushr', 'disable' + 'Capping', 't-' + '30', 'device' + ' a', 'device' + ' b'];
  for (const term of prohibited) assert.equal(candidate.toLowerCase().includes(term.toLowerCase()), false, term);
});
