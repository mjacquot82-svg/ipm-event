import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, Intl, Date, require: name => name in imports ? imports[name] : require(name) });
  return exports;
}
const primitive = tag => function TestPrimitive({ children }) { return React.createElement(tag, {}, children); };
const { PopularReminderEvents } = load('src/components/admin/PopularReminderEvents.tsx', {
  'react-native': { View: primitive('div'), ScrollView: primitive('div'), Text: primitive('span'), StyleSheet: { create: value => value } },
  '../../theme/colors': { colors: {} },
});
const item = (id, starts, count) => ({ schedule_item_id: id, title: 'Tractor Show', starts_at: starts, location_name: 'Main Ring', reminder_count: count });
const render = (items, loading = false) => renderToStaticMarkup(React.createElement(PopularReminderEvents, { items, loading }));

test('renders distinct timeslots, Toronto date/time, location and counts', () => {
  const html = render([item('a', '2026-09-22T14:00:00Z', 5), item('b', '2026-09-22T18:00:00Z', 3)]);
  assert.equal((html.match(/Tractor Show/g) || []).length, 2);
  for (const text of ['Sep 22, 2026', '10:00 a.m.', '2:00 p.m.', 'EDT', 'Main Ring', '5', '3', 'reminders']) assert.ok(html.includes(text), html);
});

test('only ten compact rows; explicit loading, empty and unavailable states', () => {
  assert.equal((render(Array.from({ length: 12 }, (_, i) => item(String(i), '2026-09-22T14:00:00Z', 1))).match(/Tractor Show/g) || []).length, 10);
  assert.match(render(null, true), /Loading reminder popularity/);
  assert.match(render(null), /temporarily unavailable/);
  assert.match(render([]), /No reminder stars/);
  assert.match(readFileSync('src/components/admin/PopularReminderEvents.tsx', 'utf8'), /maxHeight: 320/);
});

test('uses authenticated admin request, no new tracking or polling, Analytics only', async () => {
  const calls = [];
  const service = load('src/services/adminAnalyticsService.ts', { './adminAuthService': { adminRequest: async path => { calls.push(path); return { items: [] }; } } });
  await service.getPopularReminderEvents();
  assert.deepEqual(calls, ['/api/admin/analytics/reminders/popular-events']);
  const dashboard = readFileSync('src/components/admin/AnalyticsDashboard.tsx', 'utf8');
  assert.match(dashboard, /Most Popular Reminder Events/);
  assert.match(dashboard, /Counts are reminder stars for individual schedule timeslots\./);
  assert.match(dashboard, /getReminderSummary\(\), getPopularReminderEvents\(\)/);
  assert.match(dashboard, /<PopularReminderEvents items=/);
  assert.doesNotMatch(readFileSync('src/components/admin/PopularReminderEvents.tsx', 'utf8'), /setInterval|fetch\(|track\(/);
  function visit(dir) { for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (dir === 'app' && entry.name === 'admin') continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) visit(path);
    else if (/\.[jt]sx?$/.test(path)) assert.doesNotMatch(readFileSync(path, 'utf8'), /PopularReminderEvents|popular-events/);
  } }
  visit('app');
});
