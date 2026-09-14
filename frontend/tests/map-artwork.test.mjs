import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import ts from 'typescript';

function harness({ idle = true, fail = false, decodeFail = false, never = false, online = true, saveData = false } = {}) {
  let now = 0, next = 1; const tasks = new Map(), starts = [], images = [], marks = [];
  const later = (fn, delay = 0) => { const id = next++; tasks.set(id, { at: now + delay, fn }); return id; };
  class Image {
    set src(url) { this.url = url; starts.push({ url, at: now }); images.push(this); if (!never) later(() => fail ? this.onerror?.() : this.onload?.(), 10); }
    decode() { return decodeFail ? Promise.reject(new Error('SVG decode')) : Promise.resolve(); }
  }
  const window = { Image, ...(idle ? { requestIdleCallback: fn => later(fn, 1), cancelIdleCallback: id => tasks.delete(id) } : {}) };
  const context = { window, document: { readyState: 'complete', visibilityState: 'visible' }, navigator: { onLine: online, connection: { saveData } }, performance: { now: () => now, getEntriesByType: () => [], mark: name => marks.push(name) }, setTimeout: later, clearTimeout: id => tasks.delete(id), exports: {}, require: name => ({ uri: name }) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/services/mapArtwork.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  async function tick(ms) { const end = now + ms; while (true) { const sorted = [...tasks].filter(([, v]) => v.at <= end).sort((a,b) => a[1].at-b[1].at); if (!sorted.length) break; const [id,t] = sorted[0]; tasks.delete(id); now=t.at; t.fn(); for(let i=0;i<8;i++) await Promise.resolve(); } now=end; }
  return { ...context.exports, starts, images, marks, context, tick };
}

test('Home grace period, idle yield, sequential priority and no duplicate queue', async () => {
 const h=harness(); h.scheduleMapArtworkPreload(); h.scheduleMapArtworkPreload(); await h.tick(2999); assert.equal(h.starts.length,0);
 await h.tick(5000); assert.deepEqual(h.starts.map(s=>s.url.split('/').at(-1)), ['grounds-site-map.jpg','tented-city-map-app-ready.svg','rv-park-detail-map.png']);
 assert.ok(h.starts[1].at-h.starts[0].at>=1000);assert.ok(h.starts[2].at-h.starts[1].at>=1000);
 await h.preloadArtwork('grounds'); assert.equal(h.starts.length,3);
});
test('unsupported idle API still waits and completes',async()=>{const h=harness({idle:false});h.scheduleMapArtworkPreload();await h.tick(2999);assert.equal(h.starts.length,0);await h.tick(5000);assert.equal(h.starts.length,3)});
test('SVG decode rejection is a usable load, not a queue deadlock',async()=>{const h=harness({decodeFail:true});h.scheduleMapArtworkPreload();await h.tick(8000);assert.equal(h.starts.length,3)});
test('load failures continue sequentially without automatic retry storm',async()=>{const h=harness({fail:true});h.scheduleMapArtworkPreload();await h.tick(8000);assert.equal(h.starts.length,3)});
test('hung image has a bounded timeout and permits subsequent artwork',async()=>{const h=harness({never:true});h.scheduleMapArtworkPreload();await h.tick(43000);assert.equal(h.starts.length,3)});
test('offline, data saver and hidden page defer background work',async()=>{for(const settings of [{online:false},{saveData:true},{}]){const h=harness(settings);if(!Object.keys(settings).length)h.context.document.visibilityState='hidden';h.scheduleMapArtworkPreload();await h.tick(12000);assert.equal(h.starts.length,0)}});
test('navigation cleanup cancels scheduled idle work',async()=>{const h=harness();const stop=h.scheduleMapArtworkPreload();await h.tick(3000);stop();await h.tick(10000);assert.equal(h.starts.length,0)});
test('cleanup while downloading prevents subsequent preload',async()=>{const h=harness();const stop=h.scheduleMapArtworkPreload();await h.tick(3001);stop();await h.tick(10000);assert.equal(h.starts.length,1)});
