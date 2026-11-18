// Run with MANUAL_TEST_MODULES pointing to an isolated npm toolchain containing
// typescript@5.9.3, react@19.1.0 and react-test-renderer@19.1.0.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';

const require = createRequire(process.env.MANUAL_TEST_MODULES
  ? resolve(process.env.MANUAL_TEST_MODULES, 'package.json') : import.meta.url);
const React = require('react');
const { create, act } = require('react-test-renderer');
const ts = require('typescript');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const component = new URL('../src/components/ManualGlassesOrderForm.tsx', import.meta.url);
const service = new URL('../src/services/volunteerGlassesService.ts', import.meta.url);

function load(url, mocks) {
  const source = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => mocks[name] ?? require(name), mod, mod.exports);
  return mod.exports;
}

async function fixture(submit) {
  const storage = new Map();
  globalThis.window = { sessionStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  } };
  const api = load(service, { './adminAuthService': { getApiBaseUrl: () => 'https://fixture.invalid' } });
  const Form = load(component, {
    react: React,
    'react-native': { Platform: { OS: 'web' }, Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'Button', View: 'View' },
    '../services/volunteerGlassesService': { ...api, submitManualGlassesOrder: submit },
  }).default;
  let tree; let refreshes = 0;
  const mount = async () => { await act(() => { tree = create(React.createElement(Form, { password: 'fixture-owner', onSaved: async () => { refreshes++; }, styles: {} })); }); };
  await mount();
  const input = label => tree.root.findByProps({ accessibilityLabel: label });
  return {
    storage, input,
    get tree() { return tree; }, get refreshes() { return refreshes; },
    button: () => tree.root.findByType('Button'),
    async fill() { await act(() => { input('Order name').props.onChangeText('Late Pat'); input('Order contact').props.onChangeText('pat@example.test'); input('Colored Logo sets').props.onChangeText('2'); input('Short Etched sets').props.onChangeText('1'); }); },
    async remount() { await act(() => tree.unmount()); await mount(); },
    async close() { await act(() => tree.unmount()); },
  };
}

test('manual service sends only owner authentication and retains retry key', async () => {
  let captured;
  globalThis.fetch = async (url, init) => { captured = { url, init }; return { ok: true, json: async () => ({ id: 'fixture' }) }; };
  const api = load(service, { './adminAuthService': { getApiBaseUrl: () => 'https://fixture.invalid' } });
  const order = { request_id: '73848b53-e989-4942-bb32-bfa2df06b4dd', name: 'Pat', contact: 'fixture', quantities: { colored_logo: 1 } };
  await api.submitManualGlassesOrder('fixture-owner', order);
  assert.equal(captured.url, 'https://fixture.invalid/api/volunteer-glasses/admin/orders');
  assert.equal(captured.init.headers['X-Admin-Password'], 'fixture-owner');
  assert.equal(captured.init.headers['X-Volunteer-Password'], undefined);
  assert.deepEqual(JSON.parse(captured.init.body), order);
});

test('form validates before sending, calculates total and suppresses repeated clicks', async () => {
  let finish; const calls = [];
  const f = await fixture((password, order) => { calls.push({ password, order }); return new Promise(resolve => { finish = resolve; }); });
  await act(async () => f.button().props.onPress());
  assert.equal(calls.length, 0);
  await f.fill();
  assert.match(JSON.stringify(f.tree.toJSON()), /\$48.00/);
  let save;
  await act(() => { const press = f.button().props.onPress; save = press(); press(); });
  assert.equal(calls.length, 1);
  assert.equal(f.button().props.disabled, true);
  assert.equal(f.input('Order name').props.editable, false);
  assert.equal(f.storage.size, 1);
  assert.doesNotMatch([...f.storage.values()][0], /fixture-owner/);
  await act(async () => { finish({ total_sets: 3, total_cents: 4800 }); await save; });
  assert.equal(f.storage.size, 0);
  assert.equal(f.input('Order name').props.value, '');
  assert.equal(f.refreshes, 1);
  assert.match(JSON.stringify(f.tree.toJSON()), /Order saved: 3 sets/);
  await f.close();
});

test('uncertain save locks the payload and reload retries identical request', async () => {
  const calls = [];
  const f = await fixture(async (_, order) => { calls.push(order); if (calls.length === 1) throw new Error('response lost'); return { total_sets: 3, total_cents: 4800 }; });
  await f.fill();
  await act(async () => f.button().props.onPress());
  assert.equal(f.input('Order name').props.editable, false);
  assert.match(JSON.stringify(f.tree.toJSON()), /Retry same order/);
  await f.remount();
  assert.equal(f.input('Order name').props.value, 'Late Pat');
  await act(async () => f.button().props.onPress());
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(f.storage.size, 0);
  await f.close();
});

test('definitive validation rejection permits corrections; unavailable storage blocks sending', async () => {
  let calls = 0;
  const f = await fixture(async () => { calls++; throw Object.assign(new Error('Invalid quantity'), { status: 422 }); });
  await f.fill();
  await act(async () => f.button().props.onPress());
  assert.equal(f.input('Order name').props.editable, true);
  assert.equal(f.storage.size, 0);
  window.sessionStorage.setItem = () => { throw new Error('storage unavailable'); };
  await act(async () => f.button().props.onPress());
  assert.equal(calls, 1);
  await f.close();
});

test('owner form is rendered only inside authenticated list', () => {
  const page = readFileSync(new URL('../app/volunteer-glasses-orders.tsx', import.meta.url), 'utf8');
  assert.ok(page.indexOf('<ManualGlassesOrderForm') > page.indexOf('{!data ?'));
  assert.ok(page.indexOf('<ManualGlassesOrderForm') > page.indexOf('Download CSV'));
});
