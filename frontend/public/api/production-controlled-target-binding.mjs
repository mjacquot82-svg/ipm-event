const ORIGIN='https://theipm.ca';
const API='https://ipm-backend-eoiw.onrender.com/api/notification-registrations/bind-controlled-target';
const REASONS=['ORIGIN_REJECTED','CAPABILITY_INVALID','CONTROLLED_TARGET_COUNT','CONTROLLED_TARGET_INVALID','PROJECT_ABSENT','PILOT_ALREADY_SET','OBSERVATION_ON','REPAIR_ON','METADATA_PRESENT','EVENT_MISMATCH','CAPABILITY_UNOWNED','REGISTRATION_COUNT','CONTROLLED_TARGET_MISMATCH','UNAVAILABLE'];
export async function bindControlledTarget(env=globalThis) {
 if(env.location?.origin!==ORIGIN)return {reason:'ORIGIN_REJECTED'};
 try {
  const capability=env.localStorage.getItem('@ipm_notification_capability_v1');
  if(typeof capability!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(capability))return {reason:'CAPABILITY_INVALID'};
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),70000);
  try {
   const r=await env.fetch(API,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal,headers:{'Content-Type':'application/json','X-Notification-Device-Capability':capability},body:'{}'});
   const body=await r.json();
   if(r.ok&&body.bound===true&&body.pilot_restriction_count===1&&body.controlled_target_count===1&&body.controlled_target_match===true&&body.observation_enabled===false&&body.repair_enabled===false)return body;
   return {reason:REASONS.includes(body.reason)?body.reason:'UNAVAILABLE'};
  }finally{clearTimeout(timer);}
 }catch{return {reason:'UNAVAILABLE'};}
}
if(typeof document!=='undefined')document.getElementById('bind').addEventListener('click',async()=>{const b=document.getElementById('bind');b.disabled=true;document.getElementById('result').textContent=JSON.stringify(await bindControlledTarget(),null,2);});
