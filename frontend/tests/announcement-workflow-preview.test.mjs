import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/admin/index.tsx', import.meta.url), 'utf8');

test('admin preview is local and exposes both representations', () => {
  assert.match(source, /Notification preview/);
  assert.match(source, /In-app announcement preview/);
  assert.match(source, /current unsaved values/);
  assert.match(source, /does not save, publish, register a device, or contact WonderPush/);
});

test('normal editorial actions use explicit terminology and confirmations', () => {
  assert.match(source, /Save Draft/);
  assert.match(source, /Send to Attendees/);
  assert.match(source, /Send this announcement to attendees\?/);
  assert.match(source, /Publish without notification/);
  assert.match(source, /Publish this announcement to the app\?/);
});

test('create and edit forms expose the complete normal workflow before saving', () => {
  assert.match(source, /onPress=\{\(\) => setShowPreview\(true\)\}/);
  assert.match(source, /Send to Attendees/);
  assert.match(source, /Secondary action/);
  assert.match(source, /Create an announcement, preview how it will look, then choose when to send it to attendees\./);
  assert.doesNotMatch(source, /Published announcements appear in the attendee app immediately\./);
});
