import assert from 'node:assert/strict';
import test from 'node:test';
import { safeAnnouncementDestination, wonderPushAnnouncementDestination } from '../src/services/notificationDeepLinkCore.ts';

const origin = 'https://theipm.ca';
const id = '123e4567-e89b-42d3-a456-426614174000';

test('production WonderPush clicks retain the announcement detail destination', () => {
  const message = { sdk: 'wonderpush-jssdk', type: 'nativeNotificationOpen', data: { _wp: { targetUrl: `${origin}/announcements/${id}` } } };
  assert.equal(wonderPushAnnouncementDestination(message, origin), `/announcements/${id}`);
});

test('staging, external, malformed, and non-announcement destinations are rejected', () => {
  for (const target of [`https://staging.theipm.ca/announcements/${id}`, `https://evil.example/announcements/${id}`, `${origin}/schedule`, `${origin}/announcements/not-a-uuid`]) {
    assert.equal(safeAnnouncementDestination(target, origin), null);
  }
});
