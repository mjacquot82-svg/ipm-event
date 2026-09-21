import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(path, imports, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(resolve(path), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, require: (name) => name in imports ? imports[name] : require(name), setTimeout, clearTimeout, AbortController, ...globals });
  return exports;
}
const healthy = { status: 'healthy', backend: 'ok', supabase: 'ok', event: 'ipm-2026' };
const manifest = { environment: 'production', event: 'ipm-2026', schedule: { revision: 1, updatedAt: '2026-09-21T00:00:00Z' }, announcements: { revision: 1, updatedAt: '2026-09-21T00:00:00Z' } };
function service(responses, requests = []) {
  return load('src/services/systemHealthService.ts', { './adminAuthService': { getApiBaseUrl: () => 'https://backend.test' } }, { fetch: async (url, options) => {
    requests.push({ url, options });
    const response = responses[requests.length - 1];
    if (response instanceof Error) throw response;
    return { ok: response.ok ?? true, json: async () => response.body };
  } });
}
const statuses = (result) => Array.from(result.rows, row => row.status);

test('healthy reads are GET only; crons not inferred from web scheduler switches', async () => {
  const requests = [];
  const result = await service([{ body: healthy }, { body: manifest }, { body: { provider_configured: true, scheduler_enabled: false, delivery_kill_switch: true } }], requests).checkSystemHealth();
  assert.deepEqual(statuses(result), ['Healthy', 'Healthy', 'Healthy', 'Healthy', 'Not tracked', 'Not tracked', 'Healthy']);
  assert.equal(requests.length, 3);
  for (const { options } of requests) { assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store'); assert.equal(options.body, undefined); }
  assert.equal(requests[1].url, '/content-manifest.json');
  assert.match(result.rows[6].detail, /Configured only/);
  assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
});

test('503 shows backend degraded and dependency unavailable; failures remain independent', async () => {
  const result = await service([{ ok: false, body: { ...healthy, status: 'degraded', supabase: 'unavailable' } }, { body: manifest }, { body: { provider_configured: false } }]).checkSystemHealth();
  assert.deepEqual(statuses(result), ['Healthy', 'Degraded', 'Unavailable', 'Healthy', 'Not tracked', 'Not tracked', 'Degraded']);
});

test('network failures are unavailable without losing the running frontend status', async () => {
  const result = await service([new Error('offline'), new Error('offline'), new Error('offline')]).checkSystemHealth();
  assert.deepEqual(statuses(result), ['Healthy', 'Unavailable', 'Unavailable', 'Unavailable', 'Not tracked', 'Not tracked', 'Unavailable']);
});

test('wrong event, invalid manifest and unknown provider never produce healthy status', async () => {
  for (const invalid of [{}, { ...manifest, event: 'staging' }, { ...manifest, schedule: { revision: -1, updatedAt: 'bad' } }]) {
    const result = await service([{ body: { ...healthy, event: 'other' } }, { body: invalid }, { body: {} }]).checkSystemHealth();
    assert.equal(result.rows[1].status, 'Unavailable');
    assert.equal(result.rows[3].status, 'Unavailable');
    assert.equal(result.rows[6].status, 'Unavailable');
  }
});

test('admin view renders real status labels, timestamp, limitations and refresh', async () => {
  const primitive = tag => ({ children, accessibilityLabel, disabled }) => React.createElement(tag, { 'aria-label': accessibilityLabel, disabled }, children);
  const { SystemHealthView } = load('src/components/admin/SystemHealth.tsx', {
    'react-native': { View: primitive('div'), Text: primitive('span'), Pressable: primitive('button'), StyleSheet: { create: value => value } },
    '../../theme/colors': { colors: {} }, '../../services/systemHealthService': {},
  });
  const snapshot = await service([{ ok: false, body: { ...healthy, status: 'degraded' } }, new Error('fail'), { body: { provider_configured: true } }]).checkSystemHealth();
  const html = renderToStaticMarkup(React.createElement(SystemHealthView, { snapshot, checking: false, onRefresh: () => {} }));
  for (const text of ['System Health', 'Last checked:', 'Healthy', 'Degraded', 'Unavailable', 'Not tracked in app.', 'Configured only', 'Refresh system health']) assert.ok(html.includes(text), text);
  const busy = renderToStaticMarkup(React.createElement(SystemHealthView, { snapshot, checking: true, onRefresh: () => {} }));
  assert.match(busy, /disabled/);
  assert.match(busy, /Checking/);
});

test('health section is mounted only in admin analytics; no polling or attendee route edits', () => {
  assert.match(readFileSync('src/components/admin/AnalyticsDashboard.tsx', 'utf8'), /<SystemHealth \/>/);
  const component = readFileSync('src/components/admin/SystemHealth.tsx', 'utf8');
  assert.doesNotMatch(component, /setInterval/);
  assert.match(component, /if \(inFlight.current\) return/);
  function visit(dir) { for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (dir === 'app' && entry.name === 'admin') continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) visit(path);
    else if (/\.[jt]sx?$/.test(path)) assert.doesNotMatch(readFileSync(path, 'utf8'), /SystemHealth|systemHealthService|\/api\/health/);
  } }
  visit('app');
});
