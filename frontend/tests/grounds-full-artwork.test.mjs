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
const { groundsLayerLayout } = load(new URL('../src/config/groundsLayout.ts', import.meta.url));
const component = fs.readFileSync(new URL('../src/components/GroundsMap.tsx', import.meta.url), 'utf8');

test('Grounds uses the full-image layout and renders artwork without a second crop or offset', () => {
  assert.match(component, /const layer = useMemo\(\(\) => groundsLayerLayout\(viewport\)/);
  assert.doesNotMatch(component, /groundsPhoneLayerLayout|GROUNDS_HEADER_HEIGHT|headerHeight|grounds-artwork-crop/);
  assert.match(component, /source=\{MAP_SOURCE\} resizeMode="stretch" style=\{styles.image\}/);
});

test('initial full artwork is centered, uncropped and maximally fitted at phone/tablet/desktop sizes', () => {
  for (const width of [320, 360, 390, 393, 412, 768, 1024, 1440]) {
    for (const height of [220, 400, 608, 900]) {
      const layer = groundsLayerLayout({ width, height });
      assert.ok(Math.abs(layer.width / layer.height - 1344 / 2006) < 1e-10);
      assert.ok(layer.top >= 0 && layer.left >= 0, 'top/left source edges visible');
      assert.ok(layer.top + layer.height <= height + 1e-8, 'bottom source edge visible');
      assert.ok(layer.left + layer.width <= width + 1e-8, 'right source edge visible');
      assert.ok(Math.abs(2 * layer.top + layer.height - height) < 1e-8);
      assert.ok(Math.abs(2 * layer.left + layer.width - width) < 1e-8);
      assert.ok(Math.abs(layer.width - width) < 1e-8 || Math.abs(layer.height - height) < 1e-8, 'largest possible complete fit');
    }
  }
});
