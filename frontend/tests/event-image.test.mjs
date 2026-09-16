import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = readFileSync(new URL('../src/components/EventDetailMedia.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', code)(name => name === 'react-native' ? require('react-native-web') : require(name), mod, mod.exports);
const { EventDetailMedia, safeExternalUrl } = mod.exports;
const image = { url: 'https://example.invalid/portrait.jpg', alt: 'Fixture presenter', width: 452, height: 640 };
const render = props => renderToStaticMarkup(React.createElement(EventDetailMedia, props));
test('omitted and null images produce exactly no markup', () => {
  assert.equal(render({}), ''); assert.equal(render({image:null}), '');
});
test('image is accessible, lazy and proportional', () => {
  const html=render({image});
  assert.match(html,/alt="Fixture presenter"/); assert.match(html,/loading="lazy"/);
  assert.match(html,/height:auto/); assert.match(html,/width="452"/);
});
test('small images are not enlarged', () => assert.match(render({image:{...image,width:100,height:100}}),/max-width:100px/));
test('square crop is opt-in', () => {
  assert.doesNotMatch(render({image}),/event-image-top-crop/);
  assert.match(render({image:{...image,crop:'top-square'}}),/event-image-top-crop/);
});
test('unsafe URLs and invalid image metadata do not render', () => {
  for (const url of ['javascript:alert(1)','http://example.invalid/a','https://u:p@example.invalid/a','/a','https://example.invalid/a b']) {
    assert.equal(safeExternalUrl(url),false); assert.equal(render({image:{...image,url}}),'');
  }
  assert.equal(render({image:{...image,alt:' '}}),'');
  assert.equal(render({image:{...image,width:0}}),'');
});
