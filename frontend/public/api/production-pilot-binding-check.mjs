// Standalone read-only probe; requests require an explicit button press.
const ORIGIN='https://theipm.ca';
const API='https://ipm-backend-eoiw.onrender.com/api/production-diagnostics/pilot-binding';
const BOOLS=['event_slug_valid','capability_format_valid','invitation_format_valid','project_present','observation_off','repair_off','pilot_unset','bound_timestamp_unset','invitation_armed','invitation_unexpired','invitation_matches','metadata_empty','capability_owned','multiple_owned_registrations','installation_identity_eligible','snapshot_consistent'];
const STATES=['UNVERIFIABLE','ORIGIN_REJECTED','CONFIGURATION_UNAVAILABLE','INVALID_BODY','CAPABILITY_FORMAT','INVITATION_FORMAT','PROJECT_ABSENT','OBSERVATION_ON','REPAIR_ON','PILOT_ALREADY_SET','ALREADY_BOUND','INVITATION_UNARMED','INVITATION_EXPIRED','INVITATION_MISMATCH','METADATA_PRESENT','CAPABILITY_UNOWNED','INSTALLATION_IDENTITY','ELIGIBLE_COUNT_NOT_ONE','READ_UNAVAILABLE','READ_LIMIT','SNAPSHOT_CHANGED','CURRENT_GATES_PASS'];
export function sanitize(r={}) {
 const out=Object.fromEntries(BOOLS.map(k=>[k,typeof r[k]==='boolean'?r[k]:'unverifiable']));
 for(const k of ['owned_registration_count','eligible_registration_count'])out[k]=Number.isSafeInteger(r[k])&&r[k]>=0?r[k]:'unverifiable';
 out.diagnostic_status=STATES.includes(r.diagnostic_status)?r.diagnostic_status:'UNVERIFIABLE';return out;
}
export async function checkBinding(invitation,env=globalThis) {
 const local={origin_valid:env.location?.origin===ORIGIN,capability_format_valid:false,invitation_format_valid:typeof invitation==='string'&&/^[A-Za-z0-9_-]{43}$/.test(invitation),request_attempted:false,response_received:false,http_status:0};
 if(!local.origin_valid)return {...sanitize({diagnostic_status:'ORIGIN_REJECTED'}),...local};
 try{
  const capability=env.localStorage.getItem('@ipm_notification_capability_v1');
  local.capability_format_valid=typeof capability==='string'&&/^[A-Za-z0-9_-]{43}$/.test(capability);
  if(!local.capability_format_valid||!local.invitation_format_valid)return {...sanitize({diagnostic_status:!local.capability_format_valid?'CAPABILITY_FORMAT':'INVITATION_FORMAT'}),...local};
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),70000);
  try{
   local.request_attempted=true;
   const response=await env.fetch(API,{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal,headers:{'Content-Type':'application/json','X-Notification-Device-Capability':capability},body:JSON.stringify({invitation})});
   local.response_received=true;local.http_status=response.status;
   return {...sanitize(await response.json()),...local};
  }finally{clearTimeout(timer);}
 }catch{return {...sanitize({diagnostic_status:'READ_UNAVAILABLE'}),...local};}
}
if(typeof document!=='undefined')document.getElementById('check').addEventListener('click',async()=>{
 document.getElementById('check').disabled=true;const input=document.getElementById('invitation');
 const invitation=input.value;input.value='';input.disabled=true;
 document.getElementById('result').textContent=JSON.stringify(await checkBinding(invitation),null,2)+'\nRead-only current-state check. Do not retry binding.';
});
