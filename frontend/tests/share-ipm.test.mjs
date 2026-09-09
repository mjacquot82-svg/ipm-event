import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { shareIpm, IPM_SHARE_PAYLOAD } from '../src/utils/shareIpm.ts';

const expected = {
  title: 'International Plowing Match 2026',
  text: 'Get schedules, maps, announcements and event information in the official IPM app.',
  url: 'https://theipm.ca',
};
test('native share receives only the fixed public payload and does not copy', async () => {
  let received;
  assert.equal(await shareIpm({ share: async data => { received = data; }, clipboard: { writeText: () => assert.fail('unexpected copy') } }), 'native');
  assert.deepEqual(received, expected);
  assert.deepEqual(IPM_SHARE_PAYLOAD, expected);
});
test('native cancellation is normal and never copies', async () => {
  assert.equal(await shareIpm({ share: async () => { throw new DOMException('cancel', 'AbortError'); }, clipboard: { writeText: () => assert.fail('unexpected copy') } }), 'cancelled');
});
for (const native of ['unavailable', 'failure']) {
  test(`${native} native share falls back to canonical clipboard URL`, async () => {
    let copied;
    const browser = { clipboard: { writeText: async value => { copied = value; } } };
    if (native === 'failure') browser.share = async () => { throw new Error('private error details'); };
    assert.equal(await shareIpm(browser), 'copied');
    assert.equal(copied, 'https://theipm.ca');
  });
}
for (const browser of [{}, { clipboard: { writeText: async () => { throw new Error('denied'); } } }, { share: async () => { throw null; } }]) {
  test('unavailable or failed clipboard returns explicit manual fallback', async () => {
    assert.equal(await shareIpm(browser), 'manual');
  });
}
test('sharing has no network, storage, permission, installation or private-data dependencies', () => {
  const source = readFileSync(new URL('../src/utils/shareIpm.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|AsyncStorage|location\.|console\.|Notification|WonderPush|requestPermission|beforeinstallprompt|staging\.theipm\.ca/);
  const home = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  assert.match(home, /quickAction\('share_ipm', 'share'/);
  assert.match(home, /IPM link copied/);
  assert.match(home, /<Text selectable[^>]*>\{IPM_SHARE_PAYLOAD.url\}/);
  const labels = readFileSync(new URL('../src/components/admin/AnalyticsDashboard.tsx', import.meta.url), 'utf8');
  assert.match(labels, /share_ipm: 'Share IPM'/);
});
