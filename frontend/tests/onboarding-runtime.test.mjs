import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { detectInstallEnvironment } from '../src/utils/installEnvironment.ts';
import { notificationHelp } from '../src/utils/notificationHelp.ts';

// Execute the actual components with deterministic hooks and inert platform/SDK adapters.
// Provider and browser writes are counted, never sent to a real service.
function harness(file, {state='default', health='VERIFIED', setupFails=false, online=true, ua='Mozilla/5.0 Android Chrome/130.0', standalone=false, props={}, storage=new Map()}={}) {
 const slots=[],effects=[],listeners=new Map();let index=0,tree,dirty=false;
 const calls={read:0,subscribe:0,unsubscribe:0,register:[],prompt:0,holds:0};
 const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
 const hooks={
  createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),
  useState:(initial)=>{let i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{const n=typeof v==='function'?v(slots[i]):v;if(n!==slots[i]){slots[i]=n;dirty=true;}}];},
  useRef:(initial)=>{let i=index++;return slots[i]??=( {current:initial});},
  useCallback:(f,deps)=>{let i=index++;if(!slots[i]||!equal(slots[i].deps,deps))slots[i]={f,deps};return slots[i].f;},
  useEffect:(f,deps)=>{let i=index++;if(!slots[i]||!equal(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=f();});}},
 };
 const add=(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);};
 const win={navigator:null,matchMedia:()=>({matches:standalone}),addEventListener:add,removeEventListener:(n,f)=>listeners.get(n)?.delete(f),dispatchEvent:e=>{for(const f of listeners.get(e.type)||[])f(e);}};
 const navigator={onLine:online,userAgent:ua,platform:standalone&&ua.includes('iPad')?'MacIntel':'',maxTouchPoints:1,standalone};win.navigator=navigator;
 const sdk={getNotificationState:async()=>{calls.read++;return state;},subscribeToNotifications:async()=>{calls.subscribe++;return state='subscribed';},unsubscribeFromNotifications:async()=>{calls.unsubscribe++;return state='unsubscribed';},waitForWonderPushSessionReady:async()=>{}};
 const module={exports:{}};
 const context={module,exports:module.exports,window:win,navigator,document:{referrer:''},Event:class{constructor(type){this.type=type;}},process:{env:{}},console,
 require:(name)=>{
  if(name==='react')return {...hooks,default:hooks};
  if(name==='react-native')return {Platform:{OS:'web'},StyleSheet:{create:x=>x},Text:'Text',View:'View',ScrollView:'ScrollView',TouchableOpacity:'Button',ActivityIndicator:'Spinner'};
  if(name==='expo-router')return {useFocusEffect:f=>hooks.useEffect(f,[f])};
  if(name.includes('async-storage'))return {__esModule:true,default:{setItem:async(k,v)=>storage.set(k,v),getItem:async k=>storage.get(k)||null}};
  if(name.includes('vector-icons'))return {Feather:'Icon'};
  if(name.includes('installEnvironment'))return {detectInstallEnvironment,getInstallGuidance:env=>({heading:'Optional instructions',intro:'Optional',steps:[],primaryLabel:env.installState==='install_prompt_available'?'Add IPM':null})};
  if(name.includes('notificationHelp'))return {notificationHelp};
  if(name.includes('pwaUpdateService'))return {holdPwaUpdate:()=>{calls.holds++;return()=>calls.holds--;}};
  if(name.endsWith('subscriptionReconciliation'))return {watchReconciliation:fn=>{fn({status:health});return()=>{};}};
  if(name.endsWith('wonderPushService'))return sdk;
  if(name.endsWith('notificationRegistration'))return {ensureNotificationRegistration:async opts=>{calls.register.push(opts);if(setupFails)throw {classification:'other'};}};
  if(name.includes('wonderPushRuntimeDiagnostic'))return {recordNotificationWorkflowDiagnostic:()=>{}};
  if(name.includes('theme/colors'))return {default:{},colors:{}};
  throw Error(name);
 }};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,context);
 const render=()=>{index=0;dirty=false;tree=module.exports.default(props);while(effects.length)effects.shift()();};
 const flush=async()=>{for(let n=0;n<20;n++){if(dirty||!tree)render();await Promise.resolve();}return tree;};
 const all=(node=tree)=>!node||typeof node!=='object'?[]:[node,...node.children.flatMap(all)];
 const text=(node=tree)=>typeof node==='string'?node:node&&typeof node==='object'?node.children.map(text).join(' '):'';
 const click=async label=>{const node=all().find(n=>n.type==='Button'&&(n.props.accessibilityLabel===label||text(n)===label));assert.ok(node,'button '+label);assert.ok(!node.props.disabled);await node.props.onPress();await flush();};
 return {flush,click,text,calls,win,navigator,storage,exports:module.exports,all,setState:v=>state=v,event:async name=>{win.dispatchEvent({type:name});await flush();}};
}
for(const [name,options] of [
 ['A first Android',{}],['D Android enabled',{state:'subscribed'}],['E Android denied',{state:'denied'}],
 ['F first iPhone',{state:'unsupported',ua:'iPhone Safari/604.1'}],['H installed iPhone',{state:'default',ua:'iPhone Safari/604.1',standalone:true}],
 ['J iPhone denied',{state:'denied',ua:'iPhone Safari/604.1',standalone:true}],['K desktop',{ua:'Chrome/130.0 Windows'}],
 ['L unsupported',{state:'unsupported',ua:'UnknownBrowser'}],['N returning enabled',{state:'subscribed'}],['O returning denied',{state:'denied'}]
]) test(name+': opening and closing options never enrolls or prompts',async()=>{
 const h=harness('NotificationOptIn.tsx',options);await h.flush();const before=h.calls.register.length;
 await h.click('Notification options');assert.match(h.text(),/optional/);await h.click('Hide notification options');
 assert.equal(h.calls.subscribe,0);assert.equal(h.calls.unsubscribe,0);assert.equal(h.calls.register.length,before);
 if(options.state==='subscribed')assert.match(h.text(),/Notifications enabled/);
 if(options.state==='denied')assert.ok(!h.all().some(n=>n.props.accessibilityLabel==='Enable IPM notifications'));
});
test('explicit opt-in enrolls once and shows success; reopening is read-only',async()=>{
 const h=harness('NotificationOptIn.tsx');await h.flush();await h.click('Notification options');await h.click('Enable IPM notifications');
 assert.equal(h.calls.subscribe,1);assert.equal(h.calls.register.length,1);assert.match(h.text(),/Notifications enabled/);
 await h.click('Hide notification options');await h.click('Notification options');assert.equal(h.calls.subscribe,1);
});
test('P offline launch and Q reconnect keep controls safe and refresh once',async()=>{
 const h=harness('NotificationOptIn.tsx',{online:false});await h.flush();assert.equal(h.calls.read,0);assert.match(h.text(),/connection improves/);
 await h.click('Notification options');assert.ok(!h.all().some(n=>n.props.accessibilityLabel==='Enable IPM notifications'));
 h.navigator.onLine=true;await h.event('online');assert.equal(h.calls.read,1);assert.equal(h.calls.subscribe,0);
 h.navigator.onLine=false;await h.event('offline');assert.match(h.text(),/connection improves/);
});
test('bounded status failure gives an explicit read retry, never a permission loop',async()=>{
 const h=harness('NotificationOptIn.tsx',{state:'loading'});await h.flush();assert.match(h.text(),/temporarily unavailable/);
 await h.click('Notification options');h.setState('default');await h.click('Check notification status again');assert.equal(h.calls.read,2);assert.equal(h.calls.subscribe,0);
});
test('B native install is captured without opening help, then used only on click',async()=>{
 const h=harness('PWAInstallPrompt.tsx');h.exports.startInstallPromptCapture();await h.flush();
 h.win.dispatchEvent({type:'beforeinstallprompt',preventDefault(){},prompt:async()=>h.calls.prompt++,userChoice:Promise.resolve({outcome:'dismissed'})});await h.flush();
 assert.doesNotMatch(h.text(),/Do I need/);assert.equal(h.calls.prompt,0);
 await h.click('Add IPM to your Home Screen · Optional');await h.click('Add IPM to your Home Screen');assert.equal(h.calls.prompt,1);assert.doesNotMatch(h.text(),/Do I need/);
});
for(const ua of ['Android Chrome/130.0','iPhone Safari/604.1','Windows Chrome/130.0'])test('M dismissal never reopens install help: '+ua,async()=>{
 const h=harness('PWAInstallPrompt.tsx',{ua});h.exports.startInstallPromptCapture();await h.flush();await h.click('Add IPM to your Home Screen · Optional');await h.click('Continue without installing');
 h.win.dispatchEvent({type:'beforeinstallprompt',preventDefault(){},prompt:async()=>{},userChoice:Promise.resolve({outcome:'dismissed'})});await h.flush();assert.doesNotMatch(h.text(),/Do I need/);
});
test('C installed Android and iPhone offer status instead of another install action',async()=>{
 for(const ua of ['Android Chrome/130.0','iPhone Safari/604.1']){const h=harness('PWAInstallPrompt.tsx',{ua,standalone:true});await h.flush();assert.match(h.text(),/IPM is on your Home Screen/);assert.equal(h.calls.prompt,0);}
});
test('G/i iPhone notification help is capability-specific and preserves browser use',()=>{
 const e=detectInstallEnvironment({userAgent:'iPhone Safari/604.1'});assert.match(notificationHelp(e,'unsupported'),/16.4/);assert.match(notificationHelp(e,'unsupported'),/browse IPM here/);
});

for (const [label, options, visible] of [
 ['installed Android enabled', {state:'subscribed',standalone:true}, false],
 ['installed Android not enabled', {state:'default',standalone:true}, true],
 ['Android browser first visit', {state:'default'}, true],
 ['iPhone Safari', {state:'unsupported',ua:'iPhone Safari/604.1'}, false],
 ['installed iPhone', {state:'default',ua:'iPhone Safari/604.1',standalone:true}, true],
 ['enabled', {state:'subscribed'}, false], ['denied', {state:'denied'}, false],
 ['unsupported', {state:'unsupported'}, false], ['unavailable', {state:'error'}, false],
 ['offline', {online:false}, false], ['desktop', {state:'default',ua:'Windows Chrome/130.0'}, true],
]) test('Home presentation: '+label, async()=>{
 const h=harness('NotificationOptIn.tsx',{...options,props:{homePresentation:true}});await h.flush();
 assert.equal(h.text().includes('Get important IPM announcements and updates.'),visible);
 assert.doesNotMatch(h.text(),/Notification options|delivery|verified|VERIFIED|MISMATCH|provider-ready|reconciliation|notification health|Home Screen/);
 assert.equal(h.calls.subscribe,0);assert.equal(h.calls.unsubscribe,0);assert.equal(h.calls.prompt,0);
});
test('Home dismissal survives remount without changing itinerary storage or enrolling',async()=>{
 const storage=new Map([['@ipm_itinerary_notification_suggestion_v1','untouched']]);
 const h=harness('NotificationOptIn.tsx',{props:{homePresentation:true},storage});await h.flush();
 await h.click('Dismiss notification invitation');assert.equal(h.text(),'');
 const returning=harness('NotificationOptIn.tsx',{props:{homePresentation:true},storage});await returning.flush();
 assert.equal(returning.text(),'');assert.equal(storage.get('@ipm_itinerary_notification_suggestion_v1'),'untouched');assert.equal(h.calls.subscribe,0);
});
test('Home explicit enable still invokes existing enrollment once then hides promotion',async()=>{
 const h=harness('NotificationOptIn.tsx',{props:{homePresentation:true}});await h.flush();await h.click('Enable notifications');
 assert.equal(h.calls.subscribe,1);assert.equal(h.calls.register.length,1);assert.equal(h.text(),'');
});

for (const health of ['VERIFIED','MISMATCH','KEY_MISMATCH','CHECK_DUE']) test('attendee success is independent of background '+health,async()=>{
 const h=harness('NotificationOptIn.tsx',{state:'subscribed',health,setupFails:true,props:{initiallyExpanded:true}});
 await h.flush();assert.match(h.text(),/Notifications enabled/);
 assert.doesNotMatch(h.text(),/verified|mismatch|reconciliation|temporarily unavailable|Setup reference|Try again/i);
 assert.equal(h.calls.subscribe,0);assert.equal(h.calls.unsubscribe,0);
 const home=harness('NotificationOptIn.tsx',{state:'subscribed',health,setupFails:true,props:{homePresentation:true}});
 await home.flush();assert.equal(home.text(),'');
});
