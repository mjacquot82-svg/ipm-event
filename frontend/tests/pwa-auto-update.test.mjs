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

function createHarness({ controlled = true, waiting = null, online = true, visibility = 'visible', update } = {}) {
  const serviceWorkerEvents = eventTarget();
  const windowEvents = eventTarget();
  const documentEvents = eventTarget();
  let reloads = 0;
  let updateCalls = 0;
  let nextTimerId = 1;
  const timers = new Map();
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
  const context = vm.createContext({
    module,
    exports: module.exports,
    navigator: {
      onLine: online,
      serviceWorker: { controller: controlled ? {} : null, ...serviceWorkerEvents },
    },
    window: { location: { reload: () => { reloads += 1; } }, ...windowEvents },
    document: { visibilityState: visibility, ...documentEvents },
    setInterval(callback) {
      const id = nextTimerId++;
      timers.set(id, callback);
      return id;
    },
    clearInterval(id) { timers.delete(id); },
    Promise,
  });
  vm.runInContext(compiled, context);
  return {
    api: module.exports,
    registration,
    serviceWorkerEvents,
    windowEvents,
    document: context.document,
    documentEvents,
    navigator: context.navigator,
    activeTimers: () => timers.size,
    tickTimers: () => [...timers.values()].forEach((callback) => callback()),
    reloads: () => reloads,
    updateCalls: () => updateCalls,
  };
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

function waitingWorker() {
  const messages = [];
  return { messages, postMessage: (message) => messages.push(message) };
}

test('a waiting worker activates automatically when Home is safe', () => {
  const worker = waitingWorker();
  const harness = createHarness({ waiting: worker });
  harness.api.setPwaUpdateSafeState(true);
  harness.api.startPwaUpdateFlow(harness.registration);
  assert.equal(worker.messages.length, 1);
  assert.equal(worker.messages[0].type, 'IPM_ACTIVATE_UPDATE');
  assert.equal(harness.activeTimers(), 0);
});

test('Home becoming safe checks immediately and schedules a 45-second foreground check', async () => {
  const harness = createHarness();
  harness.api.startPwaUpdateFlow(harness.registration);
  await flushPromises();
  const beforeHome = harness.updateCalls();
  harness.api.setPwaUpdateSafeState(true);
  assert.equal(harness.updateCalls(), beforeHome + 1);
  assert.equal(harness.activeTimers(), 1);
  await flushPromises();
  harness.tickTimers();
  assert.equal(harness.updateCalls(), beforeHome + 2);
});

test('foreground scheduler stops off Home, when hidden, when offline, and when disposed', () => {
  const harness = createHarness();
  harness.api.setPwaUpdateSafeState(true);
  const dispose = harness.api.startPwaUpdateFlow(harness.registration);
  assert.equal(harness.activeTimers(), 1);
  harness.api.setPwaUpdateSafeState(false);
  assert.equal(harness.activeTimers(), 0);
  harness.api.setPwaUpdateSafeState(true);
  harness.document.visibilityState = 'hidden';
  harness.documentEvents.dispatch('visibilitychange');
  assert.equal(harness.activeTimers(), 0);
  harness.document.visibilityState = 'visible';
  harness.documentEvents.dispatch('visibilitychange');
  assert.equal(harness.activeTimers(), 1);
  harness.navigator.onLine = false;
  harness.windowEvents.dispatch('offline');
  assert.equal(harness.activeTimers(), 0);
  harness.navigator.onLine = true;
  harness.windowEvents.dispatch('online');
  assert.equal(harness.activeTimers(), 1);
  dispose();
  assert.equal(harness.activeTimers(), 0);
});

test('pageshow, focus, visible resume, and online retain update checks', async () => {
  const harness = createHarness();
  harness.api.startPwaUpdateFlow(harness.registration);
  await flushPromises();
  for (const event of ['pageshow', 'focus']) {
    const before = harness.updateCalls();
    harness.windowEvents.dispatch(event);
    assert.equal(harness.updateCalls(), before + 1);
    await flushPromises();
  }
  let before = harness.updateCalls();
  harness.documentEvents.dispatch('visibilitychange');
  assert.equal(harness.updateCalls(), before + 1);
  await flushPromises();
  before = harness.updateCalls();
  harness.windowEvents.dispatch('online');
  assert.equal(harness.updateCalls(), before + 1);
});

test('update checks never overlap', async () => {
  let finishUpdate;
  const pendingUpdate = new Promise((resolve) => { finishUpdate = resolve; });
  const harness = createHarness({ update: () => pendingUpdate });
  harness.api.setPwaUpdateSafeState(true);
  harness.api.startPwaUpdateFlow(harness.registration);
  harness.windowEvents.dispatch('focus');
  harness.windowEvents.dispatch('pageshow');
  harness.tickTimers();
  assert.equal(harness.updateCalls(), 1);
  finishUpdate();
  await flushPromises();
  harness.windowEvents.dispatch('focus');
  assert.equal(harness.updateCalls(), 2);
});

test('a waiting worker stays deferred on sensitive flows and activates after reaching Home', () => {
  const worker = waitingWorker();
  const harness = createHarness({ waiting: worker });
  harness.api.setPwaUpdateSafeState(false);
  harness.api.startPwaUpdateFlow(harness.registration);
  assert.equal(worker.messages.length, 0);
  harness.windowEvents.dispatch('focus');
  assert.equal(worker.messages.length, 0);
  harness.api.setPwaUpdateSafeState(true);
  assert.equal(worker.messages.length, 1);
});

test('safe resume activates once and controller changes reload exactly once', () => {
  const worker = waitingWorker();
  const harness = createHarness({ waiting: worker });
  harness.api.startPwaUpdateFlow(harness.registration);
  harness.api.setPwaUpdateSafeState(true);
  harness.windowEvents.dispatch('focus');
  harness.document.visibilityState = 'visible';
  harness.documentEvents.dispatch('visibilitychange');
  assert.equal(worker.messages.length, 1);
  harness.serviceWorkerEvents.dispatch('controllerchange');
  harness.serviceWorkerEvents.dispatch('controllerchange');
  assert.equal(harness.reloads(), 1);
});

test('first install and an already-current build do not activate or reload', () => {
  const firstWorker = waitingWorker();
  const firstInstall = createHarness({ controlled: false, waiting: firstWorker });
  firstInstall.api.setPwaUpdateSafeState(true);
  firstInstall.api.startPwaUpdateFlow(firstInstall.registration);
  firstInstall.serviceWorkerEvents.dispatch('controllerchange');
  assert.equal(firstWorker.messages.length, 0);
  assert.equal(firstInstall.reloads(), 0);

  const current = createHarness();
  current.api.setPwaUpdateSafeState(true);
  current.api.startPwaUpdateFlow(current.registration);
  current.serviceWorkerEvents.dispatch('controllerchange');
  assert.equal(current.reloads(), 0);
});

test('offline resume preserves a downloaded update but does not perform a network check', () => {
  const worker = waitingWorker();
  const harness = createHarness({ waiting: worker, online: false });
  harness.api.startPwaUpdateFlow(harness.registration);
  harness.windowEvents.dispatch('focus');
  assert.equal(harness.updateCalls(), 0);
  assert.equal(worker.messages.length, 0);
  harness.api.setPwaUpdateSafeState(true);
  assert.equal(worker.messages.length, 1);
});
