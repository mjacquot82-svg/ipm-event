import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const source = readFileSync('src/components/admin/AnalyticsDashboard.tsx', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
function load(react = React, native = require('react-native-web')) {
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name === 'react' ? react : name === 'react-native' ? native : name.endsWith('theme/colors') ? { colors: {} } : {}, mod, mod.exports);
  return mod.exports.TrafficChart;
}
const TrafficChart = load();
const rows = count => Array.from({ length: count }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), sessions: i % 4 }));
const props = { labelKey: 'date', valueKey: 'sessions', empty: 'Empty', showNavigation: true };

test('all, 30d and 7d retain every supplied row in original chronology, including zeros', () => {
  for (const count of [264, 30, 7]) {
    const data = rows(count);
    const html = renderToStaticMarkup(React.createElement(TrafficChart, { ...props, rows: data, startAtEnd: count === 264 }));
    let previous = -1;
    for (const row of data) {
      const index = html.indexOf(`${row.date}: ${row.sessions} sessions`);
      assert.ok(index > previous, row.date); previous = index;
    }
    assert.equal((html.match(/aria-label="2026-/g) || []).length, count);
    assert.match(html, /scroll left for earlier history|Scroll to view all dates/);
  }
  assert.match(renderToStaticMarkup(React.createElement(TrafficChart, { ...props, rows: [{ date: '2026-09-21', sessions: 0 }] })), /2026-09-21: 0 sessions/);
});

function simulatedChart(startAtEnd) {
  const refs = [];
  const react = { ...React, useRef: value => { const ref = { current: value }; refs.push(ref); return ref; } };
  const Chart = load(react, { ScrollView: 'ScrollView', View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x } });
  const tree = Chart({ ...props, rows: rows(264), startAtEnd });
  const chart = tree.props.children[1];
  const calls = [];
  refs[0].current = { scrollToEnd: options => calls.push(['end', options]), scrollTo: options => calls.push(['start', options]) };
  return { tree, chart, calls };
}

test('All Time waits for content and viewport, scrolls to newest once, allows later manual navigation', () => {
  for (const contentFirst of [true, false]) {
    const { tree, chart, calls } = simulatedChart(true);
    assert.equal(chart.props.showsHorizontalScrollIndicator, true);
    assert.equal(chart.props.focusable, true);
    const layout = () => chart.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
    const content = () => chart.props.onContentSizeChange(12000, 190);
    (contentFirst ? content : layout)(); assert.equal(calls.length, 0);
    (contentFirst ? layout : content)();
    assert.deepEqual(calls, [['end', { animated: false }]]);
    layout(); content(); assert.equal(calls.length, 1);
    const buttons = tree.props.children[0].props.children[1].props.children;
    buttons[0].props.onPress(); buttons[1].props.onPress();
    assert.deepEqual(calls.slice(1), [['start', { x: 0, animated: true }], ['end', { animated: true }]]);
  }
});

test('daily 7d/30d do not auto-scroll; hourly retains original hidden indicator and no navigation', () => {
  const { chart, calls } = simulatedChart(false);
  chart.props.onContentSizeChange(12000, 190); chart.props.onLayout({ nativeEvent: { layout: { width: 320 } } });
  assert.deepEqual(calls, []);
  const refs = [];
  const Chart = load({ ...React, useRef: value => { const ref = { current: value }; refs.push(ref); return ref; } }, { ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: x => x } });
  const hourly = Chart({ rows: [{ hour: '10', sessions: 2 }], labelKey: 'hour', valueKey: 'sessions', empty: 'Empty' });
  assert.equal(hourly.type, 'ScrollView');
  assert.equal(hourly.props.showsHorizontalScrollIndicator, false);
  assert.equal(hourly.props.onLayout, undefined);
  assert.equal(hourly.props.onContentSizeChange, undefined);
  assert.match(source, /<MiniPanel title="Today by Hour"><TrafficChart rows=\{traffic.traffic.todayByHour\} labelKey="hour" valueKey="sessions" empty="No sessions have been recorded today\." \/>/);
  assert.match(source, /key=\{traffic.range\} showNavigation startAtEnd=\{traffic.range === 'all'\}/);
  assert.doesNotMatch(source.slice(source.indexOf('export function TrafficChart'), source.indexOf('function MiniPanel')), /\.slice\(|\.reverse\(/);
});
