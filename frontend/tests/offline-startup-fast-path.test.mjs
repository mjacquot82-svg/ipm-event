import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('cold-offline web startup renders routes immediately and defers network services', async () => {
  const [layout, scheduling] = await Promise.all([
    read('../app/_layout.tsx'),
    read('../src/services/startupPerformance.web.ts'),
  ]);
  assert.match(layout, /useState\(Platform\.OS !== 'web'\)/);
  assert.match(layout, /runOnlineAfterFirstPaint[\s\S]*setAnalyticsRoute/);
  assert.match(layout, /runOnlineAfterFirstPaint[\s\S]*initializeWonderPush/);
  assert.match(scheduling, /navigator\.onLine !== false/);
  assert.match(scheduling, /addEventListener\('online', resume, \{ once: true \}\)/);
  assert.match(scheduling, /requestAnimationFrame\(task\)/);
});

test('cached Home hydration begins after first Home commit without awaiting refresh services', async () => {
  const home = await read('../app/(tabs)/index.tsx');
  assert.match(home, /markStartupStage\('home_render_started'\)/);
  assert.match(home, /markStartupStage\('home_mounted'\)[\s\S]*fetchSchedule\(\);[\s\S]*fetchAnnouncements\(\);[\s\S]*loadFavorites\(\);/);
  assert.match(home, /result\.source === 'cache'[\s\S]*cached_home_data_available/);
  assert.doesNotMatch(home, /await Promise\.all\(\[fetchSchedule\(\), fetchAnnouncements\(\)/);
});

test('offline startup performs no provider verification and resumes it on reconnection', async () => {
  const [notificationOptIn, analytics] = await Promise.all([
    read('../src/components/NotificationOptIn.tsx'),
    read('../src/analytics/analyticsClient.ts'),
  ]);
  assert.match(notificationOptIn, /navigator\.onLine === false/);
  assert.match(notificationOptIn, /addEventListener\('online', resume, \{ once: true \}\)/);
  assert.match(notificationOptIn, /Notification status will refresh when your connection improves/);
  assert.match(notificationOptIn, /void refresh\(\)/);
  assert.match(analytics, /navigator\.onLine === false[\s\S]*initializer_deferred_offline/);
});

test('startup timings remain local and cover cached document through visual Home', async () => {
  const [html, timing, home] = await Promise.all([
    read('../public/index.html'),
    read('../src/services/startupPerformance.web.ts'),
    read('../app/(tabs)/index.tsx'),
  ]);
  assert.match(html, /cached_document_started/);
  assert.match(html, /bundle_requested/);
  assert.match(timing, /__IPM_STARTUP_TIMINGS__/);
  assert.doesNotMatch(timing, /fetch\(|XMLHttpRequest|sendBeacon/);
  assert.match(home, /home_visually_rendered/);
  assert.match(home, /cached_home_data_available/);
});
