import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Exercise the actual geometry and painter, including their JSON input.
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href).exports;
  const mod = { exports: {} }; cache.set(url.href, mod);
  const source = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const require = (name) => name.endsWith('.json')
    ? JSON.parse(fs.readFileSync(new URL(name, url), 'utf8'))
    : name.startsWith('.') ? load(new URL(name + '.ts', url)) : createRequire(url)(name);
  new Function('require', 'module', 'exports', source)(require, mod, mod.exports);
  return mod.exports;
}
const { boothHighlightStyle } = load(new URL('../src/config/tentedCityHighlight.ts', import.meta.url));
const { TENTED_CITY_INDIVIDUAL_BOOTHS: booths } = load(new URL('../src/config/tentedCityGeometry.ts', import.meta.url));
const { tentedCityLayerLayout } = load(new URL('../src/config/tentedCityLayout.ts', import.meta.url));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`all ${booths.length} individual booth highlights remain cell-centered at ${viewport.width}px`, () => {
    const layer = tentedCityLayerLayout(viewport);
    for (const booth of booths) for (const [border, outset] of [[3, 0], [4, 0], [1, 1]]) {
      const r = booth.rect, style = boothHighlightStyle(r, layer, border, outset);
      const cx = (r.x + r.w / 2) * layer.width / 100;
      const cy = (r.y + r.h / 2) * layer.height / 100;
      assert.ok(style.borderWidth * 2 <= Math.min(style.width, style.height));
      near(style.width - outset * 2, r.w * layer.width / 100);
      near(style.height - outset * 2, r.h * layer.height / 100);
      for (const zoom of [1, 2, 3.15, 6]) {
        near((style.left + style.width / 2) * zoom + 37, cx * zoom + 37);
        near((style.top + style.height / 2) * zoom - 83, cy * zoom - 83);
      }
    }
  });
}

test('ACE/JCB fixed 4px borders would enlarge the cell; fitted borders do not', () => {
  const { rect } = booths.find(b => b.id === '1A-09');
  const style = boothHighlightStyle(rect, { width: 390, height: 390 * 603 / 774 }, 4);
  assert.ok(style.width < 8);
  assert.ok((8 - style.width) * 3.15 / 2 > 7.9);
  assert.ok(style.borderWidth * 2 < style.width);
});
