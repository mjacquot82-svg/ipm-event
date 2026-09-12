import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/services/pwaUpdateService.web.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const current = listeners.get(type) || [];
      current.push(listener);
      listeners.set(type, current);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) || []).filter((current) => current !== listener));
    },
    dispatch(type) {
      for (const listener of listeners.get(type) || []) listener();
    },
  };
}

function createHarness({
  controlled = true,
  waiting = null,
  online = true,
  visibility = 'visible',
  localEntry = '/_expo/static/js/web/entry-local.js',
  liveEntry = '/_expo/static/js/web/entry-local.js',
  fetchImpl,
  update,
  now = Date.now(),
} = {}) {
  const serviceWorkerEvents = eventTarget();
  const documentEvents = eventTarget();
  let reloads = 0;
  let updateCalls = 0;
  let fetchCalls = 0;
  let clock = now;
  const registrationEvents = eventTarget();
  const registration = {
    waiting,
    installing: null,
    ...registrationEvents,
    update() {
      updateCalls += 1;
      return update ? update() : Promise.resolve();
    },
  };
  const module = { exports: {} };
  const script = { getAttribute: () => localEntry };
  const context = vm.createContext({
    module,
    exports: module.exports,
    navigator: {
      onLine: online,
      serviceWorker: { controller: controlled ? {} : null, ...serviceWorkerEvents },
    },
    window: {
      location: { reload: () => { reloads += 1; } },
    },
    document: {
      visibilityState: visibility,
      getElementsByTagName: () => [script],
      ...documentEvents,
    },
    fetch: async (...args) => {
      fetchCalls += 1;
      if (fetchImpl) return fetchImpl(...args);
      return {
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => `<script src="${liveEntry}"></script>`,
      };
    },
    Date: {
      now: () => clock,
    },
    Object,
    Promise,
    Boolean,
    setTimeout,
    clearTimeout,
  });
  // Bind real Date only for toISOString on diagnostics via new Date()
  context.Date = class extends Date {
    static now() { return clock; }
  };
  vm.runInContext(compiled, context);
  return {
    api: module.exports,
    registration,
    serviceWorkerEvents,
    document: context.document,
    documentEvents,
    navigator: context.navigator,
    reloads: () => reloads,
    updateCalls: () => updateCalls,
    fetchCalls: () => fetchCalls,
    setClock: (value) => { clock = value; },
    advance: (ms) => { clock += ms; },
    constants: module.exports.__PWA_UPDATE_TEST_CONSTANTS__,
  };
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

function waitingWorker() {
  const messages = [];
  return { messages, postMessage: (message) => messages.push(message) };
}

test('active visible app does not poll or auto-activate a waiting worker', async () => {
  const worker = waitingWorker();
  const harness = createHarness({ waiting: worker });
  const seen = [];
  harness.api.subscribeToPwaUpdates((available) => seen.push(available));
  harness.api.startPwaUpdateFlow(harness.registration);
  await flushPromises();
  assert.equal(worker.messages.length, 0);
  assert.equal(harness.updateCalls(), 0);
  assert.equal(harness.fetchCalls(), 0);
  assert.ok(seen.includes(true));
  assert.equal(harness.reloads(), 0);
});

test('resume below 10 minutes does not run an update check', async () => {
  const harness = createHarness();
  harness.api.startPwaUpdateFlow(harness.registration);
  harness.api.__setLastBackgroundedAtForTests(harness.constants.BACKGROUND_THRESHOLD_MS);
  harness.setClock(harness.constants.BACKGROUND_THRESHOLD_MS + 60_000);
  harness.document.visibilityState = 'visible';
  harness.documentEvents.dispatch('visibilitychange');
  await flushPromises();
  assert.equal(harness.updateCalls(), 0);
  assert.equal(harness.fetchCalls(), 0);
});

test('resume after ≥10 minutes runs a single fingerprint and SW check', async () => {
  const harness = createHarness({
    liveEntry: '/_expo/static/js/web/entry-newer.js',
  });
  const seen = [];
  harness.api.subscribeToPwaUpdates((available) => seen.push(available));
  harness.api.startPwaUpdateFlow(harness.registration);
  const backgroundedAt = 1_000_000;
  harness.api.__setLastBackgroundedAtForTests(backgroundedAt);
  harness.setClock(backgroundedAt + harness.constants.BACKGROUND_THRESHOLD_MS);
  harness.document.visibilityState = 'visible';
  harness.documentEvents.dispatch('visibilitychange');
  await flushPromises();
  assert.equal(harness.updateCalls(), 1);
  assert.equal(harness.fetchCalls(), 1);
  assert.ok(seen.includes(true));

  // A second immediate visibility pulse without a fresh long background does nothing.
  const updatesBefore = harness.updateCalls();
  const fetchesBefore = harness.fetchCalls();
  harness.documentEvents.dispatch('visibilitychange');
  await flushPromises();
  assert.equal(harness.updateCalls(), updatesBefore);
  assert.equal(harness.fetchCalls(), fetchesBefore);
});

test('Later dismisses without spam until another ≥10 minute background period', async () => {
  const harness = createHarness({
    liveEntry: '/_expo/static/js/web/entry-newer.js',
  });
  let available = false;
  harness.api.subscribeToPwaUpdates((next) => { available = next; });
  harness.api.startPwaUpdateFlow(harness.registration);
  harness.api.__setLastBackgroundedAtForTests(0);
  harness.setClock(harness.constants.BACKGROUND_THRESHOLD_MS);
  harness.documentEvents.dispatch('visibilitychange');
  await flushPromises();
  assert.equal(available, true);
  harness.api.dismissPwaUpdate();
  assert.equal(available, false);

  harness.api.__setLastBackgroundedAtForTests(harness.constants.BACKGROUND_THRESHOLD_MS);
  harness.setClock(harness.constants.BACKGROUND_THRESHOLD_MS + 60_000);
  harness.documentEvents.dispatch('visibilitychange');
  await flushPromises();
  assert.equal(available, false);

  harness.api.__setLastBackgroundedAtForTests(2_000_000);
  harness.setClock(2_000_000 + harness.constants.BACKGROUND_THRESHOLD_MS);
  harness.documentEvents.dispatch('visibilitychange');
  await flushPromises();
  assert.equal(available, true);
});

test('Refresh posts one activate message and reloads exactly once', () => {
  const worker = waitingWorker();
  const harness = createHarness({ waiting: worker });
  harness.api.startPwaUpdateFlow(harness.registration);
  harness.api.activatePwaUpdate();
  harness.api.activatePwaUpdate();
  assert.equal(worker.messages.length, 1);
  assert.equal(worker.messages[0].type, 'IPM_ACTIVATE_UPDATE');
  harness.serviceWorkerEvents.dispatch('controllerchange');
  harness.serviceWorkerEvents.dispatch('controllerchange');
  assert.equal(harness.reloads(), 1);
});

test('failed fingerprint or SW update checks never reload or disrupt', async () => {
  const harness = createHarness({
    fetchImpl: async () => { throw new Error('offline'); },
    update: async () => { throw new Error('sw failed'); },
  });
  let available = false;
  harness.api.subscribeToPwaUpdates((next) => { available = next; });
  harness.api.startPwaUpdateFlow(harness.registration);
  harness.api.__setLastBackgroundedAtForTests(0);
  harness.setClock(harness.constants.BACKGROUND_THRESHOLD_MS);
  harness.documentEvents.dispatch('visibilitychange');
  await flushPromises();
  assert.equal(available, false);
  assert.equal(harness.reloads(), 0);
});

test('first install and already-current builds do not activate or reload', () => {
  const firstWorker = waitingWorker();
  const firstInstall = createHarness({ controlled: false, waiting: firstWorker });
  let firstAvailable = false;
  firstInstall.api.subscribeToPwaUpdates((next) => { firstAvailable = next; });
  firstInstall.api.startPwaUpdateFlow(firstInstall.registration);
  firstInstall.serviceWorkerEvents.dispatch('controllerchange');
  assert.equal(firstWorker.messages.length, 0);
  assert.equal(firstAvailable, false);
  assert.equal(firstInstall.reloads(), 0);

  const current = createHarness();
  current.api.startPwaUpdateFlow(current.registration);
  current.serviceWorkerEvents.dispatch('controllerchange');
  assert.equal(current.reloads(), 0);
});

test('interaction holds defer the prompt and the post-Refresh reload', () => {
  const worker = waitingWorker();
  const harness = createHarness({ waiting: worker });
  let available = false;
  harness.api.subscribeToPwaUpdates((next) => { available = next; });
  const release = harness.api.holdPwaUpdate();
  harness.api.startPwaUpdateFlow(harness.registration);
  assert.equal(available, false);
  release();
  assert.equal(available, true);

  const holdDuringReload = harness.api.holdPwaUpdate();
  harness.api.activatePwaUpdate();
  harness.serviceWorkerEvents.dispatch('controllerchange');
  assert.equal(harness.reloads(), 0);
  holdDuringReload();
  assert.equal(harness.reloads(), 1);
});

test('unsafe notification/opt-in state defers the prompt until safe', () => {
  const worker = waitingWorker();
  const harness = createHarness({ waiting: worker });
  let available = false;
  harness.api.subscribeToPwaUpdates((next) => { available = next; });
  harness.api.setPwaUpdateSafeState(false);
  harness.api.startPwaUpdateFlow(harness.registration);
  assert.equal(available, false);
  harness.api.setPwaUpdateSafeState(true);
  assert.equal(available, true);
});

test('offline resume preserves a waiting worker prompt without network checks', async () => {
  const worker = waitingWorker();
  const harness = createHarness({ waiting: worker, online: false });
  let available = false;
  harness.api.subscribeToPwaUpdates((next) => { available = next; });
  harness.api.startPwaUpdateFlow(harness.registration);
  assert.equal(available, true);
  harness.api.__setLastBackgroundedAtForTests(0);
  harness.setClock(harness.constants.BACKGROUND_THRESHOLD_MS);
  harness.documentEvents.dispatch('visibilitychange');
  await flushPromises();
  assert.equal(harness.updateCalls(), 0);
  assert.equal(harness.fetchCalls(), 0);
  assert.equal(worker.messages.length, 0);
});
