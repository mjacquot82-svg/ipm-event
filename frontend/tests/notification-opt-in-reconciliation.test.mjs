import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { reconciliationStates } from '../src/services/subscriptionReconciliationCore.ts';

const source = readFileSync(new URL('../src/components/NotificationOptIn.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
} }).outputText;

// Render the real component with deterministic hooks and inert service doubles.
// No network, browser permission request, or provider SDK is available here.
function fixture({ notificationState = 'subscribed', failure = 'pilot_verification_pending' } = {}) {
  const slots = []; let cursor = 0; let mounted = false; let watcher;
  const effects = []; const calls = { registration: 0, subscribe: 0, unsubscribe: 0 };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useCallback: value => value,
    useEffect(effect) { if (!mounted) effects.push(effect); },
  };
  const mocks = {
    react,
    'react-native': { Platform: { OS: 'web' }, StyleSheet: { create: x => x },
      View: 'View', Text: 'Text', TouchableOpacity: 'Button', ActivityIndicator: 'Spinner' },
    'expo-router': { useFocusEffect() {} },
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} },
    '../services/subscriptionReconciliation': { watchReconciliation(fn) { watcher = fn; return () => {}; } },
    '../services/wonderPushService': { getNotificationState: async () => notificationState,
      subscribeToNotifications() { calls.subscribe++; throw Error('unexpected subscription'); },
      unsubscribeFromNotifications() { calls.unsubscribe++; throw Error('unexpected unsubscription'); } },
    '../services/notificationRegistration': { async ensureNotificationRegistration() {
      calls.registration++; if (failure) throw { classification: failure, stage: 'provider_verification' };
    } },
    '../services/wonderPushRuntimeDiagnostic': { recordNotificationWorkflowDiagnostic() {} },
    '../services/pwaUpdateService': { holdPwaUpdate: () => () => {} },
    '../theme/colors': { colors: {} },
    '../utils/installEnvironment': { detectInstallEnvironment: () => ({ platform: 'android', installState: 'installed' }) },
    '../utils/notificationHelp': { notificationHelp: () => 'Browser help' },
  };
  const context = { exports: {}, require(name) { assert.ok(name in mocks, name); return mocks[name]; },
    navigator: { onLine: true }, window: { navigator: {}, addEventListener() {}, removeEventListener() {} } };
  vm.runInNewContext(code, context);
  const render = () => { cursor = 0; const tree = context.exports.default({ persistent: true }); mounted = true; return tree; };
  render(); effects.forEach(effect => effect());
  return { render, calls, emit: status => watcher({ status }), settle: async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); } };
}
function nodes(tree) { return tree && typeof tree === 'object' ? [tree, ...tree.children.flatMap(nodes)] : []; }
function text(tree) { return tree && typeof tree === 'object' ? tree.children.map(text).join(' ') : String(tree ?? ''); }
const uncertain = 'We couldn’t verify notification setup right now. Your IPM app will keep working.';
const mismatch = 'Your notification setup could not be verified on this device. You can keep using IPM.';
const active = ['SDK_SETTLING', 'COMPARING', 'PATCH_PENDING', 'VERIFYING', 'CHECK_DUE'];

for (const status of reconciliationStates) test(`NotificationOptIn renders ${status} honestly without service calls`, async () => {
  const f = fixture(); await f.settle(); const before = { ...f.calls };
  f.emit(status); const tree = f.render(); const content = text(tree);
  assert.ok(content.includes(status === 'VERIFIED' ? 'Notifications are enabled on this device.' : status === 'MISMATCH' ? mismatch : uncertain));
  assert.equal(content.includes('Notifications are enabled on this device.'), status === 'VERIFIED');
  assert.ok(!content.includes('temporarily unavailable'));
  assert.equal(content.includes('Try again'), status !== 'VERIFIED' && !active.includes(status));
  assert.deepEqual(f.calls, before);
});

test('registration pending catch does not overwrite a mismatch with unavailable copy', async () => {
  const f = fixture(); f.emit('MISMATCH'); await f.settle();
  assert.ok(text(f.render()).includes(mismatch));
  const retry = nodes(f.render()).find(n => n.props.accessibilityLabel === 'Try notification setup again');
  assert.equal(retry.props.disabled, false); retry.props.onPress(); await f.settle();
  assert.equal(f.calls.registration, 2); assert.equal(f.calls.subscribe, 0); assert.equal(f.calls.unsubscribe, 0);
});

test('legacy registration success alone does not claim reconciliation VERIFIED', async () => {
  const f = fixture({ failure: null }); await f.settle();
  assert.ok(text(f.render()).includes(uncertain));
  assert.ok(!text(f.render()).includes('Notifications are enabled on this device.'));
});

for (const [notificationState, copy] of [
  ['denied', 'Notifications are blocked in your browser settings.'],
  ['unsupported', 'Notifications aren’t available in this browser. You can still use IPM.'],
  ['error', 'Notifications are temporarily unavailable. The IPM app will continue to work.'],
]) test(`${notificationState} keeps its browser messaging`, async () => {
  const f = fixture({ notificationState }); await f.settle(); f.emit('DEFERRED');
  assert.ok(text(f.render()).includes(copy)); assert.equal(f.calls.registration, 0);
});

test('real registration failure remains a failure', async () => {
  const f = fixture({ failure: 'http_error' }); await f.settle();
  assert.ok(text(f.render()).includes('Notifications are temporarily unavailable. You can keep using IPM.'));
});

test('later unverified outcome replaces a previously verified message and can recover', async () => {
  const f = fixture(); await f.settle();
  for (const status of ['VERIFIED', 'DEFERRED', 'MISMATCH', 'VERIFIED']) {
    f.emit(status); const content = text(f.render());
    assert.equal(content.includes('Notifications are enabled on this device.'), status === 'VERIFIED');
    assert.ok(!content.includes('temporarily unavailable'));
  }
});

for (const status of reconciliationStates.filter(s => s !== 'VERIFIED')) {
  test(`${status} remains cautious after the registration pending catch`, async () => {
    const f = fixture(); f.emit(status); await f.settle();
    const content = text(f.render());
    assert.ok(content.includes(status === 'MISMATCH' ? mismatch : uncertain));
    assert.ok(content.includes('Try again'));
    assert.ok(!content.includes('temporarily unavailable'));
    assert.ok(!content.includes('Notifications are enabled on this device.'));
  });
}
