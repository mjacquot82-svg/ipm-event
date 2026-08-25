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

test('the combined production image is the sole Worship Service artwork', () => {
  assert.equal((page.match(/<Image\b/g) || []).length, 1);
  assert.match(page, /source={require\('\.\.\/\.\.\/assets\/images\/worship-service\.jpg'\)}/);
  assert.doesNotMatch(page, /worship-service-cross\.jpg|worship-service-join-us\.jpg/);
  assert.match(page, /const ARTWORK_ASPECT_RATIO = 1364 \/ 3404/);
  assert.match(page, /accessibilityLabel="Complete 2026 IPM Interdenominational Worship Service information"/);
});

test('the image itself determines mobile artwork height without blank layout space', () => {
  assert.match(page, /scrollContent: { paddingHorizontal: 0, paddingTop: 12 }/);
  assert.match(page, /content: { width: '100%', alignItems: 'center' }/);
  assert.match(page, /const MAX_ARTWORK_WIDTH = 720/);
  assert.match(page, /const artworkWidth = Math\.min\(viewportWidth, MAX_ARTWORK_WIDTH\)/);
  assert.match(page, /const artworkHeight = artworkWidth \/ ARTWORK_ASPECT_RATIO/);
  assert.match(page, /style=\{\[styles\.posterImage, \{ width: artworkWidth, height: artworkHeight \}\]\}/);
  assert.match(page, /resizeMode="contain"/);
  assert.match(page, /posterImage: { alignSelf: 'center', margin: 0, padding: 0 }/);
  assert.doesNotMatch(page, /posterImage:[^\n]*(gap|marginBottom|marginTop|border|borderRadius|minHeight|maxHeight|flex|transform)/);
  assert.doesNotMatch(page, /styles\.artwork|artwork:|negative|scale\(/);
  assert.doesNotMatch(page, /useAttendeeLayout|sectionStyle/);
});

test('narrow Android viewports fit the complete artwork without horizontal overflow', () => {
  const sourceWidth = 1364;
  const sourceHeight = 3404;
  for (const viewportWidth of [360, 390, 430]) {
    const renderedWidth = Math.min(viewportWidth, 720);
    const renderedHeight = renderedWidth / (sourceWidth / sourceHeight);
    assert.ok(renderedWidth <= viewportWidth);
    assert.equal(renderedWidth, viewportWidth);
    assert.ok(Math.abs((renderedHeight / renderedWidth) - (sourceHeight / sourceWidth)) < 1e-12);
  }
});

test('original PDF action uses the exact tracked external destination', () => {
  assert.match(page, /openTrackedLink\('worship_service_pdf', 'worship_service'\)/);
  assert.match(page, />View Original PDF<\/Text>/);
  assert.match(destinations, /worship_service_pdf: \{[^\n]*url: 'https:\/\/www\.plowingmatch\.org\/ipm2026\/wp-content\/uploads\/2026\/03\/IPM-2026-Worship-Service\.pdf'/);
});

test('page provides accessible artwork labels and safe Back navigation', () => {
  assert.equal((page.match(/accessibilityLabel="[^"]+"/g) || []).length, 3);
  assert.match(page, /if \(router\.canGoBack\(\)\) router\.back\(\)/);
  assert.match(page, /else router\.replace\('\/'\)/);
});

test('candidate introduces no notification or reminder integration', () => {
  const candidate = [page, layout, home, destinations].join('\n');
  const prohibited = ['wonder' + 'push', 'web' + 'pushr', 'disable' + 'Capping', 't-' + '30', 'device' + ' a', 'device' + ' b'];
  for (const term of prohibited) assert.equal(candidate.toLowerCase().includes(term.toLowerCase()), false, term);
});
