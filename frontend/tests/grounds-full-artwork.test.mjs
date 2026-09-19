import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';

function load(url) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const require = name => name.startsWith('.') ? load(new URL(name + '.ts', url)) : createRequire(url)(name);
  new Function('require', 'module', 'exports', source)(require, module, module.exports);
  return module.exports;
}

const { groundsLayerLayout } = load(new URL('../src/config/groundsLayout.ts', import.meta.url));
const component = fs.readFileSync(new URL('../src/components/GroundsMap.tsx', import.meta.url), 'utf8');

test('Grounds uses the complete fitted image without phone-only crop logic', () => {
  assert.match(component, /groundsLayerLayout\(viewport\)/);
  assert.doesNotMatch(component, /groundsPhoneLayerLayout|GROUNDS_HEADER_HEIGHT|grounds-artwork-crop|headerHeight/);
  assert.match(component, /source=\{MAP_SOURCE\} resizeMode="stretch" style=\{styles\.image\}/);
});

test('initial artwork fit keeps all source edges visible and centered', () => {
  for (const width of [320, 390, 412, 768, 1440]) {
    for (const height of [568, 800, 900, 1024]) {
      const layer = groundsLayerLayout({ width, height });
      assert.ok(Math.abs(layer.width / layer.height - 1344 / 2006) < 1e-10);
      assert.ok(layer.left >= 0 && layer.top >= 0);
      assert.ok(layer.left + layer.width <= width + 1e-8);
      assert.ok(layer.top + layer.height <= height + 1e-8);
      assert.ok(Math.abs(2 * layer.left + layer.width - width) < 1e-8);
      assert.ok(Math.abs(2 * layer.top + layer.height - height) < 1e-8);
      assert.ok(Math.abs(layer.width - width) < 1e-8 || Math.abs(layer.height - height) < 1e-8);
    }
  }
});
