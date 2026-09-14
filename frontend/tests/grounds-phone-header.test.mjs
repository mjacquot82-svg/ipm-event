import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';

function load(url) {
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const require = name => name.startsWith('.') ? load(new URL(name + '.ts', url)) : createRequire(url)(name);
  new Function('require', 'module', 'exports', source)(require, mod, mod.exports);
  return mod.exports;
}
const { groundsPhoneLayerLayout, GROUNDS_HEADER_HEIGHT } = load(new URL('../src/config/groundsPhoneLayout.ts', import.meta.url));
const { mapPointUnderFocal } = load(new URL('../src/config/tentedCityCamera.ts', import.meta.url));

test('phone crop removes the complete printed header without changing artwork coordinates or aspect', () => {
  for (const width of [320, 360, 375, 390, 393, 412, 430, 767]) {
    for (const height of [220, 400, 608, 900]) {
      const layer = groundsPhoneLayerLayout({ width, height });
      assert.ok(Math.abs(layer.width / layer.height - 1344 / 2006) < 1e-10);
      assert.equal(layer.top + layer.headerHeight, 0, 'no blank header space');
      assert.ok(layer.height - layer.headerHeight <= height + 1e-8, 'all remaining artwork fits');
      assert.ok(layer.width <= width && layer.left >= 0);
      assert.ok(Math.abs(layer.headerHeight / layer.height - GROUNDS_HEADER_HEIGHT / 2006) < 1e-10);
      for (const [x, y] of [[.16, .16], [.222, .453], [.65, .7133], [.875, .48]]) {
        for (const scale of [1, 2, 4]) {
          const point = mapPointUnderFocal({ scale, tx: -20, ty: 30,
            focalX: layer.left - 20 + layer.width * x * scale,
            focalY: layer.top + 30 + layer.height * y * scale,
            left: layer.left, top: layer.top });
          assert.ok(Math.abs(point.x / layer.width - x) < 1e-10);
          assert.ok(Math.abs(point.y / layer.height - y) < 1e-10);
        }
      }
    }
  }
});
