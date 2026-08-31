import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const context = await readFile(new URL('../src/context/AnnouncementReadContext.tsx', import.meta.url), 'utf8');
const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const list = await readFile(new URL('../app/(tabs)/announcements.tsx', import.meta.url), 'utf8');
const detail = await readFile(new URL('../app/announcements/[announcement_id].tsx', import.meta.url), 'utf8');

test('read state is per-device, persistent, and keyed by stable announcement ID', () => {
  assert.match(context, /READ_ANNOUNCEMENTS_KEY = 'readAnnouncementIds'/);
  assert.match(context, /AsyncStorage\.getItem\(READ_ANNOUNCEMENTS_KEY\)/);
  assert.match(context, /AsyncStorage\.setItem\(READ_ANNOUNCEMENTS_KEY/);
  assert.match(context, /next\.add\(announcementId\)/);
  assert.doesNotMatch(context, /fetch\(|axios|readReceipt|wonderpush/i);
});

test('unread derives from the current visible, non-dismissed announcement IDs', () => {
  assert.match(home, /attendeeAnnouncements = excludeDismissedAnnouncements/);
  assert.match(home, /getUnreadAnnouncementIds\(attendeeAnnouncements, readAnnouncementIds, lastReadAnnouncementId\)/);
  assert.match(context, /!readAnnouncementIds\.has\(announcement\.id\)/);
  assert.match(list, /excludeDismissedAnnouncements\(announcements, dismissedAnnouncementIds\)/);
  assert.doesNotMatch(list, /markAnnouncementRead/);
});

test('opening an individual detail through any route marks only that announcement read', () => {
  assert.match(detail, /await markAnnouncementRead\(result\.id\)/);
  assert.match(detail, /useLocalSearchParams/);
  assert.match(detail, /source \|\| 'other'/);
  assert.doesNotMatch(list, /markAnnouncementRead/);
});

test('Quick Action badge is capped at 9+ without layout shift and exposes an accessible count', () => {
  assert.match(home, /unreadAnnouncementCount > 9 \? '9\+' : unreadAnnouncementCount/);
  assert.match(home, /`Announcements, \$\{unreadAnnouncementCount\} unread`/);
  assert.match(home, /announcementBadge: \{[^}]*position: 'absolute'/);
  assert.match(home, /actionCard: \{[\s\S]*?position: 'relative'/);
});

test('read and dismissed state remain separate persisted sets', () => {
  assert.match(context, /READ_ANNOUNCEMENTS_KEY/);
  assert.match(context, /DISMISSED_ANNOUNCEMENTS_KEY/);
  assert.match(detail, /markAnnouncementRead/);
  assert.match(detail, /dismissAnnouncement/);
});
