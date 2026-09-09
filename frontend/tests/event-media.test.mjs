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
const image = { url: 'https://staging.theipm.ca/event-media/gina.png', alt: 'Gina Livy, The Livy Method', width: 156, height: 221 };
const render = props => renderToStaticMarkup(React.createElement(EventDetailMedia, props));
test('old events produce no empty media placeholder', () => assert.equal(render({}), ''));
test('portrait is accessible, lazy and never enlarged beyond intrinsic size', () => {
  const html = render({ image });
  assert.match(html, /alt="Gina Livy, The Livy Method"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /max-width:156px/);
  assert.match(html, /height:auto/);
});
test('labeled links are safe and accessible; no raw URL label', () => {
  const html=render({links:[{label:"Visit Cheryl's Mary Kay page",url:'https://www.marykay.ca/cmcnair'}]});
  assert.match(html,/rel="noopener noreferrer"/);assert.match(html,/opens in a new tab/);assert.match(html,/Visit Cheryl/);
  assert.doesNotMatch(html,/>https:\/\//);
});
test('invalid links and unlabelled images do not render', () => {
  assert.equal(render({image:{...image,alt:' '},links:[{label:'bad',url:'javascript:alert(1)'}]}),'');
  for(const url of ['javascript:alert(1)','data:text/plain,a','https://user:pass@host/a','/tmp/a.jpg']) assert.equal(safeExternalUrl(url),false);
});
test('repeat appearances reference the same approved asset', () => {
  const assets=JSON.parse(readFileSync(new URL('../../backend/import_manifests/landa_content_20260909/assets.json',import.meta.url)));
  assert.equal(assets.length,3); assert.deepEqual(assets.map(x=>x.external_ids.length),[3,4,2]);
  assert.equal(new Set(assets.map(x=>x.asset)).size,3);
  assert.ok(assets.every(x=>x.alt.trim()));
});
