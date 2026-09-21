import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function load(path) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'react-native') return require('react-native-web');
    if (name === '@expo/vector-icons') return { Feather: () => null };
    if (name.endsWith('theme/colors')) return { default: {}, colors: {} };
    if (name.endsWith('theme/attendeePageLayout')) return { ATTENDEE_CARD_RADIUS: 12 };
    if (name.endsWith('analytics/notificationMetrics')) return load('src/analytics/notificationMetrics.ts');
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
const { default: Card } = load('src/components/AnnouncementCard.tsx');
const { NotificationOverview } = load('src/components/admin/NotificationOverview.tsx');
const announcement = { id: 'a1', title: 'Gate update', message: 'Full message remains accessible after opening the announcement.', priority: 'Important', created_at: '2026-09-21T19:46:00Z', image: { url: 'https://example.test/image.png', alt: 'Full announcement image', width: 120, height: 80 } };
const renderCard = props => renderToStaticMarkup(React.createElement(Card, { announcement, ...props }));

test('attendee compact preview uses two lines, metadata, tap affordance and no large image', () => {
  const html = renderCard({ preview: true, compactPreview: true });
  assert.match(html, /-webkit-line-clamp:2/);
  for (const text of ['Gate update', 'Important', 'Posted', 'Tap to read']) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /<img/);
  const list = readFileSync('app/(tabs)/announcements.tsx', 'utf8');
  assert.match(list, /announcement=\{announcement\}\s+preview\s+compactPreview/);
  assert.match(list, /router\.push\(`\/announcements\/\$\{announcement.id\}\?source=list` as never\)/);
  assert.match(list, /unread=\{hydrated && unreadIds.has\(announcement.id\)\}/);
  assert.match(list, /dismissAnnouncement\(announcement.id\)/);
});

test('tap and dismissal callbacks remain separate, full detail and composer preview preserved', () => {
  let opened = 0, dismissed = 0;
  const card = Card({ announcement, preview: true, compactPreview: true, onPress: () => opened++, onDismiss: () => dismissed++ });
  card.props.children[0].props.onPress();
  assert.equal(opened, 1); assert.equal(dismissed, 0);
  card.props.children[1].props.onPress();
  assert.equal(opened, 1); assert.equal(dismissed, 1);
  const full = renderCard({});
  assert.ok(full.includes(announcement.message));
  assert.match(full, /<img/); assert.doesNotMatch(full, /-webkit-line-clamp/);
  const composer = renderCard({ preview: true });
  assert.match(composer, /-webkit-line-clamp:3/); assert.match(composer, /<img/);
  const detail = readFileSync('app/announcements/[announcement_id].tsx', 'utf8');
  assert.match(detail, /<AnnouncementCard announcement=\{announcement\} \/>/);
});

function summary(recent) {
  return { accepted_sends: 3, failed_requests: 0, pending_requests: 0, recent,
    metrics: Object.fromEntries(['targeted_devices','receipts','opens','visits','failures'].map(key => [key, { value: key === 'visits' ? 16 : 999, covered_sends: 1, total_sends: 3 }])) };
}
test('recent sends use per-send app visits, preserve zero and unknown, never provider counts', () => {
  const recent = [16, 0, null, undefined].map((count, i) => ({ title: `Send ${i}`, sent_at: '2026-09-21T19:46:00Z', notification_origin_visit_count: count, provider_open_count: 999, provider_confirmed_receipt_count: 888 }));
  const html = renderToStaticMarkup(React.createElement(NotificationOverview, { announcements: summary(recent), reminders: null, loading: false }));
  for (const text of ['Opened from notification','Sent to WonderPush','16 opened','0 opened','Opens unavailable','Sep 21','3:46 p.m.','Repeat opens may be counted','does not prove the device displayed']) assert.ok(html.includes(text), text);
  assert.equal((html.match(/Opens unavailable/g) || []).length, 2);
  assert.doesNotMatch(html, /999 opened|888 opened|Visits through notification links|Provider accepted/);
});

test('missing sent time never relabels request time as the send time', () => {
  const html = renderToStaticMarkup(React.createElement(NotificationOverview, { announcements: summary([{ title: 'Historical', requested_at: '2026-09-21T19:46:00Z' }]), reminders: null, loading: false }));
  assert.match(html, /Sent time unavailable/); assert.match(html, /Requested Sep 21/);
  assert.match(html, /Opens unavailable/);
});
