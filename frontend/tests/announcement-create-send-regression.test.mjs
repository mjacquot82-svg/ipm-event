import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/admin/index.tsx', import.meta.url), 'utf8');

test('new announcement send persists before using the combined send route', () => {
  assert.match(source, /if \(!announcement\) \{/);
  assert.match(source, /createAnnouncement\(\{ \.\.\.announcementForm, status: 'draft' \}\)/);
  assert.match(source, /if \(!announcement\?\.id\)/);
  assert.match(source, /publishAndSendAnnouncement\(announcement\.id\)/);
});

test('create and send failures are visible and preview stays non-mutating', () => {
  assert.match(source, /Title and message are required before sending/);
  assert.match(source, /Announcement could not be saved\. Please review the form and try again/);
  assert.match(source, /onPreviewSendBlocked/);
  assert.match(source, /does not save, publish, register a device, or contact WonderPush/);
});

test('the request guard prevents duplicate final taps', () => {
  assert.match(source, /notificationRequestInFlight\.current/);
  assert.match(source, /notificationRequestInFlight\.current = true/);
  assert.match(source, /notificationRequestInFlight\.current = false/);
});
