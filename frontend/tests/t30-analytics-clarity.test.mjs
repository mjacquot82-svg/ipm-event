import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync('src/components/admin/NotificationOverview.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', code)(name => {
  if (name === 'react-native') return require('react-native-web');
  if (name.endsWith('theme/colors')) return { colors: {} };
  if (name.endsWith('analytics/notificationMetrics')) return { notificationDefinitions: {} };
  return require(name);
}, mod, mod.exports);
function render(reminders, loading = false) {
  const html = renderToStaticMarkup(React.createElement(mod.exports.NotificationOverview, { announcements: null, reminders, loading }));
  return html.slice(html.indexOf('aria-label="T-30 reminder analytics"'));
}
const labels = ['Reminders requested', 'Reminders sent', 'Phones that received it', 'Reminders opened', 'Failed'];
function card(html, label) { return html.split(`aria-label="${label}"`)[1]?.split('aria-label=')[0] || ''; }

test('current API does not turn acceptance or unknown outcomes into sent/receipt/open/failure counts', () => {
  const html = render({ active_interests: 12, provider_accepted: 999, provider_failed: 888, delivery_unknown: 777 });
  assert.match(card(html, labels[0]), />12</);
  for (const label of labels.slice(1)) assert.match(card(html, label), /Not available/);
  assert.doesNotMatch(html, /999|888|777|Active reminder interests|Reminders sent to WonderPush/);
  assert.match(html, /not a count of people/);
});

test('each provider metric has its own field and zero remains authoritative', () => {
  for (const values of [[20, 18, 7, 2], [0, 0, 0, 0]]) {
    const html = render({ active_interests: 3, provider_sent_count: values[0], provider_confirmed_receipt_count: values[1], provider_open_count: values[2], provider_failure_count: values[3] });
    labels.slice(1).forEach((label, i) => assert.match(card(html, label), new RegExp(`>${values[i]}<`)));
  }
});

test('null metrics, clear explanations, example and summary loading/failure remain honest', () => {
  const html = render({ active_interests: null, provider_sent_count: null, provider_confirmed_receipt_count: null, provider_open_count: null, provider_failure_count: null });
  for (const label of labels) assert.match(card(html, label), /Not available/);
  for (const text of ['Sent does not mean displayed', 'Receipt does not mean the person saw it', 'same phone or person more than once', '20 sent · 18 received · 7 opened']) assert.ok(html.includes(text), text);
  assert.match(render(null, true), /Loading reminders/);
  assert.match(render(null), /temporarily unavailable/);
});
