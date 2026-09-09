import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), ts=require('typescript');
const source=readFileSync(new URL('../src/components/NotificationOptIn.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
function render(state,setup,pilot){
 let index=0;const values=[state,false,false,setup,null,null,false];
 const react={...require('react'),useState:init=>[values[index++]??init,()=>{}],useCallback:fn=>fn,useEffect:()=>{},useRef:v=>({current:v})};
 const module={exports:{}};
 const mock=name=>{
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return require(name);
  if(name==='expo-router')return {useFocusEffect:()=>{}};
  if(name==='react-native')return {Platform:{OS:'web'},StyleSheet:{create:v=>v},View:'View',Text:'Text',TouchableOpacity:'Button',ActivityIndicator:'Spinner'};
  if(name==='@expo/vector-icons')return {Feather:'Icon'};
  if(name.includes('installEnvironment'))return {detectInstallEnvironment:()=>({platform:'android',installState:'installed'})};
  if(name.includes('notificationHelp'))return {notificationHelp:()=>''};
  if(name.includes('/theme/'))return {colors:{}};
  return {};
 };
 vm.runInNewContext(code,{module,exports:module.exports,require:mock,navigator:{onLine:true,userAgent:'Android'},window:{matchMedia:()=>({matches:false}),navigator:{userAgent:'Android'}}});
 return module.exports.default({});
}
test('production reconciliation states retain honest status in optional help',()=>{
 const pending=JSON.stringify(render('subscribed','pending',true));assert.match(pending,/Checking notification delivery/);assert.doesNotMatch(pending,/Disable IPM notifications/);
 assert.match(JSON.stringify(render('subscribed','failed',true)),/Notification delivery is not verified/);
 assert.match(JSON.stringify(render('subscribed','ready',true)),/Notifications are enabled on this device/);
 assert.match(JSON.stringify(render('unsubscribed','failed',true)),/Notifications are currently disabled/);
});
test('returning subscribers have status without an open enrollment prompt',()=>{
 for(const state of ['pending','ready']) {
  const ui=JSON.stringify(render('subscribed',state,false));
  assert.match(ui,/Notification options/);
  assert.doesNotMatch(ui,/Enable IPM notifications|Disable IPM notifications/);
 }
});
