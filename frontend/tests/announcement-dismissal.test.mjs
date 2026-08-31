import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const context = await readFile(new URL('../src/context/AnnouncementReadContext.tsx', import.meta.url), 'utf8');
const list = await readFile(new URL('../app/(tabs)/announcements.tsx', import.meta.url), 'utf8');
const home = await readFile(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const detail = await readFile(new URL('../app/announcements/[announcement_id].tsx', import.meta.url), 'utf8');
const admin = await readFile(new URL('../app/admin/index.tsx', import.meta.url), 'utf8');
const card = await readFile(new URL('../src/components/AnnouncementCard.tsx', import.meta.url), 'utf8');

test('dismissal is local, persistent, and keyed only by stable announcement ID', () => {
  assert.match(context, /DISMISSED_ANNOUNCEMENTS_KEY = 'dismissedAnnouncementIds'/);
  assert.match(context, /AsyncStorage\.getItem\(DISMISSED_ANNOUNCEMENTS_KEY\)/);
  assert.match(context, /AsyncStorage\.setItem\(DISMISSED_ANNOUNCEMENTS_KEY/);
  assert.match(context, /next\.add\(announcementId\)/);
  assert.doesNotMatch(context, /deleteAnnouncement|archive|fetch\(|axios|wonderpush/i);
});

test('dismissal filters attendee list and Home independently for each ID', () => {
  assert.match(context, /!dismissedIds\.has\(announcement\.id\)/);
  assert.match(list, /excludeDismissedAnnouncements\(announcements, dismissedAnnouncementIds\)/);
  assert.match(list, /visibleAnnouncements\.map/);
  assert.match(home, /excludeDismissedAnnouncements\(announcements, dismissedAnnouncementIds\)/);
  assert.match(home, /attendeeAnnouncements[\s\S]*newestUnreadAnnouncement/);
});

test('dismiss action makes no backend request and organizer views are unchanged', () => {
  assert.match(detail, /await dismissAnnouncement\(announcementId\)/);
  assert.match(detail, /goBack\(\)/);
  assert.doesNotMatch(detail, /deleteAnnouncement|setAnnouncementStatus|fetch\(|axios/);
  assert.doesNotMatch(admin, /dismissedAnnouncementIds|excludeDismissedAnnouncements|dismissAnnouncement/);
});

test('each list card has a separate accessible 44px dismissal control', () => {
  assert.match(list, /onDismiss=\{\(\) => \{ void dismissAnnouncement\(announcement\.id\); \}\}/);
  assert.match(card, /accessibilityLabel="Dismiss announcement"/);
  assert.match(card, /dismissButton: \{[^}]*height: 44[^}]*position: 'absolute'[^}]*width: 44/);
  assert.match(card, /<View style=\{styles\.cardWrapper\}>[\s\S]*<TouchableOpacity style=\{cardStyle\}[\s\S]*<TouchableOpacity[\s\S]*style=\{styles\.dismissButton\}/);
});
