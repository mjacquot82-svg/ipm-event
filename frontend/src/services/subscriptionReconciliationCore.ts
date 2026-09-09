/** No SDK initialization, subscription creation, permission or storage mutations. */
export const reconciliationStates = ['INELIGIBLE','OFFLINE_PENDING','CHECK_DUE','SDK_SETTLING','COMPARING','VERIFIED','MISMATCH','PATCH_PENDING','VERIFYING','OUTCOME_UNKNOWN','DEFERRED','IDENTITY_UNRESOLVED'] as const;
export type ReconciliationState = typeof reconciliationStates[number];
export type ReconciliationResult = {status: ReconciliationState; generation?: number; next_attempt_at?: string | null; verification_expires_at?: string | null};
export type Subscription = {endpoint:string; expirationTime?:number|null; getKey:(name:'p256dh'|'auth')=>ArrayBuffer|null; options:{applicationServerKey?:ArrayBuffer|null}};
export type Token = {data:string;p256dh:string;auth:string;applicationServerKey:string};
export function encodeKey(value:ArrayBuffer|null|undefined,size:number):string {
  if (!value || Object.prototype.toString.call(value)!=='[object ArrayBuffer]') throw new Error('DATA');
  const bytes=new Uint8Array(value);
  if(bytes.length!==size || (size===65 && bytes[0]!==4)) throw new Error('DATA');
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function snapshot(subscription:Subscription|null):Token {
  if(!subscription || (subscription.expirationTime!=null && (!Number.isFinite(subscription.expirationTime) || subscription.expirationTime<=Date.now()))) throw new Error('DATA');
  const endpoint=subscription.endpoint;
  if(!/^[\x21-\x7e]{1,8192}$/.test(endpoint)) throw new Error('DATA');
  const url=new URL(endpoint);
  if(!endpoint.startsWith('https://') || url.username || url.password || url.hash) throw new Error('DATA');
  return {data:endpoint,p256dh:encodeKey(subscription.getKey('p256dh'),65),auth:encodeKey(subscription.getKey('auth'),16),applicationServerKey:encodeKey(subscription.options.applicationServerKey,65)};
}
export function same(a:Token,b:Token) {return Object.keys(a).every(k=>a[k as keyof Token]===b[k as keyof Token]);}
export function safeResult(input:unknown):ReconciliationResult {
  const value=input as Record<string,unknown>|null;
  const result:ReconciliationResult={status:reconciliationStates.includes(value?.status as ReconciliationState)?value?.status as ReconciliationState:'DEFERRED'};
  if(typeof value?.generation==='number' && Number.isSafeInteger(value.generation) && value.generation>0) result.generation=value.generation;
  for(const k of ['next_attempt_at','verification_expires_at'] as const) if(typeof value?.[k]==='string' && /^[0-9TZ:+. -]{10,40}$/.test(value[k])) result[k]=value[k];
  return result;
}
export interface ReconciliationEnvironment {
  online:()=>boolean; permission:()=>string;
  capability:()=>string|null;
  read:()=>Promise<Subscription|null>;
  identity:()=>Promise<{installation_id:string;local_subscribed:boolean;user_id:string|null}|null>;
  settle:()=>Promise<void>;
  request:(body:unknown,capability:string)=>Promise<unknown>;
  emit:(result:ReconciliationResult)=>void;
}
export async function runReconciliation(env:ReconciliationEnvironment):Promise<ReconciliationResult> {
  const emit=(result:ReconciliationResult)=>{env.emit(result);return result;};
  if(!env.online()) return emit({status:'OFFLINE_PENDING'});
  if(env.permission()!=='granted') return emit({status:'INELIGIBLE'});
  const capability=env.capability();
  if(!capability || !/^[A-Za-z0-9_-]{43}$/.test(capability)) return emit({status:'IDENTITY_UNRESOLVED'});
  try {
    const initial=await env.read();
    if(!initial) return emit({status:'INELIGIBLE'});
    let token=snapshot(initial);
    emit({status:'SDK_SETTLING'});
    await env.settle();
    // Normal SDK synchronization gets first opportunity. No forced init/recovery.
    const identity=await env.identity();
    if(!identity || !/^[A-Za-z0-9]{40}$/.test(identity.installation_id) || identity.user_id!==null) return emit({status:'IDENTITY_UNRESOLVED'});
    if(!identity.local_subscribed || env.permission()!=='granted') return emit({status:'INELIGIBLE'});
    token=snapshot(await env.read());
    const base={...identity,permission:'granted'};
    emit({status:'COMPARING'});
    let observed=safeResult(await env.request({...base,action:'check',subscription:token,generation:1},capability));
    // A late request may not roll durable metadata back to an older subscription.
    // Re-snapshot once after receiving the server's current generation fence.
    if(observed.status==='CHECK_DUE' && observed.generation) {
      token=snapshot(await env.read());
      observed=safeResult(await env.request({...base,action:'check',subscription:token,generation:observed.generation},capability));
    }
    const current=snapshot(await env.read());
    if(!same(token,current)) {
      await env.request({...base,action:'invalidate',subscription:current,generation:observed.generation||1},capability);
      return emit({status:'CHECK_DUE'});
    }
    if(env.permission()!=='granted') return emit({status:'INELIGIBLE'});
    const afterIdentity=await env.identity();
    if(!afterIdentity?.local_subscribed || afterIdentity.installation_id!==identity.installation_id || afterIdentity.user_id!==null) return emit({status:'IDENTITY_UNRESOLVED'});
    if(observed.status==='VERIFYING' && observed.generation) {
      const confirmed=safeResult(await env.request({...base,action:'confirm',subscription:current,generation:observed.generation},capability));
      const final=snapshot(await env.read());
      if(!same(current,final)) {
        await env.request({...base,action:'invalidate',subscription:final,generation:observed.generation},capability);
        return emit({status:'CHECK_DUE'});
      }
      if(env.permission()!=='granted') return emit({status:'INELIGIBLE'});
      return emit(confirmed);
    }
    return emit(observed);
  } catch(error) {return emit({status:error instanceof Error && error.message==='DATA'?'INELIGIBLE':env.online()?'DEFERRED':'OFFLINE_PENDING'});}
}
