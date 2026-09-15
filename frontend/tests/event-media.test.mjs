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

test('Nicole uses the source-identical portrait with an opt-in top-square display crop', () => {
  const content=JSON.parse(readFileSync(new URL('../../backend/import_manifests/nicole_schneider_20260915.json',import.meta.url)));
  const html=render({image:content.patch.event_image});
  assert.match(html,/data-testid="event-image-top-crop"/);
  assert.match(html,/aspect-ratio:1/);
  assert.match(html,/overflow-x:hidden/);
  assert.match(html,/overflow-y:hidden/);
  assert.match(html,/nicole-schneider-21a20f01ecdd.jpg/);
  assert.doesNotMatch(render({image}),/event-image-top-crop/);
  assert.equal(content.external_id,'2026-09-25-quality-homes-m15');
  assert.deepEqual(Object.keys(content.patch).sort(),['description','event_image','title']);
  assert.equal(content.before.start_date,'2026-09-25');
  assert.equal(content.before.start_time,'12:15 PM');
  assert.equal(content.before.end_time,'1:15 PM');
  assert.equal(content.before.location_name,'Quality Homes - Stage');
  assert.equal(content.before.category,'MNP Lifestyles Tent Events');
  assert.ok(content.patch.description.includes('Porterhouse – Flowers By Usss'));
  assert.ok(content.patch.description.endsWith('I look forward to seeing everyone!'));
});

test('Nicole content is gated to its Deploy Preview and preserves all other events', () => {
  const { nicolePreviewContent } = require('../scripts/nicole-preview.js');
  const env={CONTEXT:'deploy-preview',HEAD:'content/nicole-schneider-lifestyles-20260915',DEPLOY_PRIME_URL:'https://deploy-preview-99--ipm-web-staging.netlify.app'};
  assert.equal(nicolePreviewContent({...env,CONTEXT:'production'}),'');
  assert.equal(nicolePreviewContent({...env,CONTEXT:'branch-deploy'}),'');
  assert.equal(nicolePreviewContent({...env,HEAD:'another-branch'}),'');
  const encoded=nicolePreviewContent(env),review=JSON.parse(encoded);
  assert.equal(review.patch.event_image.url,env.DEPLOY_PRIME_URL+'/event-media/nicole-schneider-21a20f01ecdd.jpg');
  const serviceSource=readFileSync(new URL('../src/services/spreadsheetDataService.ts',import.meta.url),'utf8');
  const serviceCode=ts.transpileModule(serviceSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const service={exports:{}};
  new Function('require','module','exports',serviceCode)(name=>name==='react-native'?{Platform:{OS:'web'}}:{},service,service.exports);
  const apply=service.exports.applyNicolePreview;
  const other={...review.before,id:'another-event'};
  const input={data:{events:[review.before,other],total_count:2,last_updated:'baseline'},source:'network',cacheAge:0,lastSuccessfulUpdate:'baseline'};
  const previous=process.env.EXPO_PUBLIC_NICOLE_REVIEW_CONTENT,oldWindow=globalThis.window;
  try {
    process.env.EXPO_PUBLIC_NICOLE_REVIEW_CONTENT=encoded;
    globalThis.window={location:{origin:'https://staging.theipm.ca'}};
    assert.equal(apply(input),input);
    globalThis.window.location.origin=env.DEPLOY_PRIME_URL;
    const output=apply(input);
    assert.deepEqual(output.data.events[0],{...review.before,...review.patch});
    assert.equal(output.data.events[1],other);
    assert.equal(input.data.events[0],review.before);
    assert.equal(output.data.total_count,2);
    const changed={...input,data:{...input.data,events:[{...review.before,start_time:'1:00 PM'}]}};
    assert.equal(apply(changed),changed);
    process.env.EXPO_PUBLIC_NICOLE_REVIEW_CONTENT='';assert.equal(apply(input),input);
  } finally {
    if(previous===undefined)delete process.env.EXPO_PUBLIC_NICOLE_REVIEW_CONTENT;else process.env.EXPO_PUBLIC_NICOLE_REVIEW_CONTENT=previous;
    if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
  }
});
