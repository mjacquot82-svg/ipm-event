import { runReconciliation, ReconciliationResult, safeResult } from './subscriptionReconciliationCore';
export type { ReconciliationResult, ReconciliationState } from './subscriptionReconciliationCore';
const BACKEND=process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/$/,'');
export function reconciliationEnabled() {
  return typeof window!=='undefined' && location.origin==='https://staging.theipm.ca' && BACKEND==='https://ipm-staging-backend.onrender.com';
}
const listeners=new Set<(result:ReconciliationResult)=>void>();
let inFlight:Promise<ReconciliationResult>|null=null;
let current:ReconciliationResult={status:'CHECK_DUE'};
export function watchReconciliation(listener:(result:ReconciliationResult)=>void) {
  listeners.add(listener); return ()=>{listeners.delete(listener);};
}
function emit(value:ReconciliationResult) {current=value;listeners.forEach(fn=>fn(value));}
export function hasExistingReconciliationCapability() {
  try {return reconciliationEnabled() && /^[A-Za-z0-9_-]{43}$/.test(localStorage.getItem('@ipm_notification_capability_v1')||'');} catch {return false;}
}
async function bounded<T>(operation:()=>Promise<T>,ms=5000):Promise<T> {
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {return await Promise.race([Promise.resolve().then(operation),new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error('UNAVAILABLE')),ms);})]);}
  finally {clearTimeout(timer);}
}
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function execute():Promise<ReconciliationResult> {
  return runReconciliation({
    online:()=>navigator.onLine!==false,permission:()=>typeof Notification!=='undefined'?Notification.permission:'unsupported',
    capability:()=>{try{return localStorage.getItem('@ipm_notification_capability_v1');}catch{return null;}},
    read:async()=>{
      const registration=await bounded(()=>navigator.serviceWorker.getRegistration('/'));
      if(!registration?.active || registration.scope!==location.origin+'/') return null;
      const worker=new URL(registration.active.scriptURL);
      if(worker.origin!==location.origin || worker.pathname!=='/webpushr-sw.js') return null;
      return bounded(()=>registration.pushManager.getSubscription());
    },
    settle:async()=>{
      // Observe the normal app initialization, never invoke initialization here.
      const until=Date.now()+10000;
      while(!window.WonderPush?.getInstallationId && Date.now()<until) await delay(250);
      await delay(1000);
    },
    identity:async()=>{
      const sdk=window.WonderPush as (typeof window.WonderPush & {getUserId?:()=>Promise<string|null>});
      if(!sdk?.getInstallationId || !sdk.isSubscribedToNotifications || !sdk.getUserId) return null;
      const [id,subscribed,user]=await bounded(()=>Promise.all([sdk.getInstallationId!(),sdk.isSubscribedToNotifications!(),sdk.getUserId!()]));
      return id?{installation_id:id,local_subscribed:subscribed,user_id:user}:null;
    },
    request:async(body,capability)=>{
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),110000);
      try {
        const response=await fetch(BACKEND+'/api/notification-registrations/reconcile',{
          method:'POST',cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal,
          headers:{'Content-Type':'application/json','X-Notification-Device-Capability':capability},body:JSON.stringify(body),
        });
        return response.ok?safeResult(await response.json()):{status:'DEFERRED'};
      }finally{clearTimeout(timer);}
    },emit,
  });
}
export function reconcileSubscription():Promise<ReconciliationResult> {
  if(!reconciliationEnabled()) return Promise.resolve({status:'INELIGIBLE'});
  if(inFlight) return inFlight;
  inFlight=(async()=>{
    try {
      if(navigator.locks) return await navigator.locks.request('ipm-subscription-reconciliation',{ifAvailable:true},async lock=>lock?execute():{status:'DEFERRED'} as ReconciliationResult);
      return await execute();
    }catch{return {status:'DEFERRED'} as ReconciliationResult;}
  })().finally(()=>{inFlight=null;});
  return inFlight;
}
export function startSubscriptionReconciliation() {
  if(!reconciliationEnabled()) return ()=>{};
  let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;let retries=0;
  const schedule=(ms=5000)=>{
    if(stopped) return;
    clearTimeout(timer);
    timer=setTimeout(async()=>{
      if(stopped || document.visibilityState==='hidden') return;
      const result=await reconcileSubscription();
      if(stopped) return;
      if(result.status==='VERIFIED') {retries=0;return;}
      if(['DEFERRED','OUTCOME_UNKNOWN','CHECK_DUE','IDENTITY_UNRESOLVED'].includes(result.status) && retries<3 && navigator.onLine) {
        const backoff=[30000,120000,600000][retries++];
        const next=result.next_attempt_at?Date.parse(result.next_attempt_at)-Date.now():0;
        schedule(Math.max(backoff,Number.isFinite(next)?next:0)+Math.floor(Math.random()*3000));
      }
    },ms);
  };
  const trigger=()=>{
    const next=current.next_attempt_at?Date.parse(current.next_attempt_at)-Date.now():0;
    schedule(Math.max(5000,Number.isFinite(next)?next:0));
  };
  window.addEventListener('online',trigger);document.addEventListener('visibilitychange',trigger);
  schedule();
  return ()=>{stopped=true;clearTimeout(timer);window.removeEventListener('online',trigger);document.removeEventListener('visibilitychange',trigger);};
}
