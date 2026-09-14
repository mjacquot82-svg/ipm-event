import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context={exports:{},require:name=>name==='react-native'?{Platform:{OS:'web'},StyleSheet:{create:x=>x}}:name.includes('groundsLayout')?{GROUNDS_IMAGE_ASPECT:1344/2006}:name.includes('tentedCityLayout')?{TENTED_CITY_IMAGE_ASPECT:1032/804}:name.includes('rvParkLayout')?{RV_PARK_IMAGE_ASPECT:1700/2200}:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/theme/desktopMapWorkspace.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
const {desktopMapWorkspace:layout,desktopMapStyles:styles}=context.exports;
test('all approved mobile widths retain existing layout',()=>{for(const w of [320,360,375,390,393,412,430,767])for(const mode of ['grounds','tented','rv'])assert.equal(layout(mode,w,900),null)});
test('every desktop width/height fits complete artwork between header, footer and navigation',()=>{
 for(const w of [768,1024,1280,1366,1440,1600,1920,2560])for(const h of [720,768,900,1080,1440])for(const [mode,aspect] of Object.entries({grounds:1344/2006,tented:1032/804,rv:1700/2200}))for(const inset of [0,59]){
  const r=layout(mode,w,h,inset),header=mode==='tented'?styles.tentedViewport.top:styles.viewport.top;
  assert.ok(r.left>=24&&r.width<=1360&&r.width>=380);
  assert.ok(Math.abs(r.left*2+r.width-w)<0.001);
  assert.ok(r.top+r.height<=h-inset-60-16+0.001);
  const mh=r.height-header-styles.viewport.bottom,mw=r.width-32;
  assert.ok(mh>0&&mw>0&&mh*aspect<=mw+0.001);
 }
});
test('each map gets its own aspect-aware width, and Tented City reserves category controls',()=>{
 const g=layout('grounds',1440,900),t=layout('tented',1440,900),r=layout('rv',1440,900);
 assert.ok(t.width>r.width&&r.width>g.width);
 assert.equal(styles.tentedViewport.top-styles.viewport.top,44);
});
