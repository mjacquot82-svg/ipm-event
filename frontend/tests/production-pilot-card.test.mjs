import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), ts=require('typescript');
const source=readFileSync(new URL('../src/components/NotificationOptIn.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
function render(state,setup,pilot){
 let index=0;const values=[state,pilot,false,false,setup,null,null,false];
 const react={...require('react'),useState:init=>[values[index++]??init,()=>{}],useCallback:fn=>fn,useEffect:()=>{},useRef:v=>({current:v})};
 const module={exports:{}};
 const mock=name=>{
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return require(name);
  if(name==='expo-router')return {useFocusEffect:()=>{}};
  if(name==='react-native')return {Platform:{OS:'web'},StyleSheet:{create:v=>v},View:'View',Text:'Text',TouchableOpacity:'Button',ActivityIndicator:'Spinner'};
  if(name==='@expo/vector-icons')return {Feather:'Icon'};
  if(name.includes('/theme/'))return {colors:{}};
  return {};
 };
 vm.runInNewContext(code,{module,exports:module.exports,require:mock,navigator:{onLine:true},window:{matchMedia:()=>({matches:false}),navigator:{userAgent:'Android'}}});
 return module.exports.default({});
}
test('pilot pending and failed states remain visible; verified hides card',()=>{
 const pending=JSON.stringify(render('subscribed','pending',true));assert.match(pending,/Checking notification delivery/);assert.doesNotMatch(pending,/Disable IPM notifications/);
 assert.match(JSON.stringify(render('subscribed','failed',true)),/Notification delivery is not verified/);
 assert.equal(render('subscribed','ready',true),null);
 assert.match(JSON.stringify(render('unsubscribed','failed',true)),/Notification delivery is not verified/);
});
test('nonpilot returning subscriber retains production hidden-card behavior',()=>{
 assert.equal(render('subscribed','pending',false),null);
 assert.equal(render('subscribed','ready',false),null);
});
