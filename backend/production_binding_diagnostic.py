"""Read-only current-state binding gates. Never invokes a binding/reconciliation RPC."""
import asyncio
import hashlib
import hmac
import json
import re
from datetime import datetime, timezone
from urllib.parse import urlencode
from fastapi import Request
from fastapi.responses import JSONResponse
try:
    from backend.production_push_diagnostic import enabled, read_json
except ModuleNotFoundError:
    from production_push_diagnostic import enabled, read_json

BOOLS = ('event_slug_valid','capability_format_valid','invitation_format_valid',
         'project_present','observation_off','repair_off','pilot_unset','bound_timestamp_unset',
         'invitation_armed','invitation_unexpired','invitation_matches','metadata_empty',
         'capability_owned','multiple_owned_registrations','installation_identity_eligible','snapshot_consistent')
STATUSES = ('UNVERIFIABLE','ORIGIN_REJECTED','CONFIGURATION_UNAVAILABLE','INVALID_BODY',
            'CAPABILITY_FORMAT','INVITATION_FORMAT','PROJECT_ABSENT','OBSERVATION_ON',
            'REPAIR_ON','PILOT_ALREADY_SET','ALREADY_BOUND','INVITATION_UNARMED',
            'INVITATION_EXPIRED','INVITATION_MISMATCH','METADATA_PRESENT',
            'CAPABILITY_UNOWNED','INSTALLATION_IDENTITY','ELIGIBLE_COUNT_NOT_ONE',
            'READ_UNAVAILABLE','READ_LIMIT','SNAPSHOT_CHANGED','CURRENT_GATES_PASS')

def result(status='UNVERIFIABLE'):
    return {**{k:'unverifiable' for k in BOOLS}, 'owned_registration_count':'unverifiable',
            'eligible_registration_count':'unverifiable', 'diagnostic_status':status}

def inspect(c, capability, invitation, read=read_json, now=None):
    out=result();out['event_slug_valid']=c['event']=='ipm-2026'
    out['capability_format_valid']=isinstance(capability,str) and re.fullmatch(r'[A-Za-z0-9_-]{43}',capability) is not None
    out['invitation_format_valid']=isinstance(invitation,str) and re.fullmatch(r'[A-Za-z0-9_-]{43}',invitation) is not None
    for field,gate in [('capability_format_valid','CAPABILITY_FORMAT'),('invitation_format_valid','INVITATION_FORMAT')]:
        if not out[field]:out['diagnostic_status']=gate;return out
    if not enabled(c['host'],c['app'],c['database'],c['event']) or not c.get('database_key'):
        out['diagnostic_status']='CONFIGURATION_UNAVAILABLE';return out
    headers={'apikey':c['database_key'],'Authorization':'Bearer '+c['database_key'],'Accept':'application/json'}
    def get(table,params):
        return read(c['database']+'/rest/v1/'+table+'?'+urlencode(params),headers)
    params={'select':'enabled,repair_enabled,pilot_registration_id,binding_invitation_hash,binding_expires_at,pilot_bound_at','limit':'2'}
    try:
        rows=get('notification_reconciliation_project',params)
        if not isinstance(rows,list):raise ValueError()
        out['project_present']=len(rows)==1
        if not out['project_present']:out['diagnostic_status']='PROJECT_ABSENT';return out
        p=rows[0]
        if any(k not in p for k in params['select'].split(',')) or type(p['enabled']) is not bool or type(p['repair_enabled']) is not bool:raise ValueError()
        out.update(observation_off=not p['enabled'],repair_off=not p['repair_enabled'],
                   pilot_unset=p['pilot_registration_id'] is None,bound_timestamp_unset=p['pilot_bound_at'] is None,
                   invitation_armed=p['binding_invitation_hash'] is not None and p['binding_expires_at'] is not None)
        out['invitation_matches']=isinstance(p['binding_invitation_hash'],str) and hmac.compare_digest(p['binding_invitation_hash'],hashlib.sha256(invitation.encode()).hexdigest())
        out['invitation_unexpired']=False
        if p['binding_expires_at'] is not None:
            expiry=datetime.fromisoformat(p['binding_expires_at'].replace('Z','+00:00'))
            if expiry.tzinfo is None:raise ValueError()
            out['invitation_unexpired']=expiry > (now or datetime.now(timezone.utc))
        gates=[('observation_off','OBSERVATION_ON'),('repair_off','REPAIR_ON'),('pilot_unset','PILOT_ALREADY_SET'),
               ('bound_timestamp_unset','ALREADY_BOUND'),('invitation_armed','INVITATION_UNARMED'),
               ('invitation_unexpired','INVITATION_EXPIRED'),('invitation_matches','INVITATION_MISMATCH')]
        for field,gate in gates:
            if not out[field]:out['diagnostic_status']=gate;return out
        # Ownership reads require the same valid private invitation and both flags OFF.
        metadata=get('notification_reconciliation',{'select':'status','limit':'1'})
        if not isinstance(metadata,list):raise ValueError()
        out['metadata_empty']=len(metadata)==0
        if not out['metadata_empty']:out['diagnostic_status']='METADATA_PRESENT';return out
        # Fetch at most two rows: sufficient for unique ownership. If multiple are
        # returned, do not infer an exact total or filter a truncated installation set.
        owned=get('notification_installations',{'select':'wonderpush_installation_id,events!inner(slug)',
            'events.slug':'eq.ipm-2026','capability_hash':'eq.'+hashlib.sha256(capability.encode()).hexdigest(),'limit':'2'})
        if not isinstance(owned,list):raise ValueError()
        out['capability_owned']=bool(owned)
        out['multiple_owned_registrations']=len(owned)>=2
        if len(owned)>=2:
            out['diagnostic_status']='READ_LIMIT';return out
        count=len(owned);out['owned_registration_count']=count
        eligible=sum(isinstance(r.get('wonderpush_installation_id'),str) and re.fullmatch(r'[A-Za-z0-9]{40}',r['wonderpush_installation_id']) is not None for r in owned)
        out['eligible_registration_count']=eligible
        out['installation_identity_eligible']=count==1 and eligible==1
        out['snapshot_consistent']=get('notification_reconciliation_project',params)==rows
        if not out['snapshot_consistent']:out['diagnostic_status']='SNAPSHOT_CHANGED';return out
        out['diagnostic_status']='CAPABILITY_UNOWNED' if count==0 else 'INSTALLATION_IDENTITY' if eligible==0 else 'CURRENT_GATES_PASS'
    except Exception:
        out['diagnostic_status']='READ_UNAVAILABLE'
    return out

def install_routes(router,config):
    @router.post('/production-diagnostics/pilot-binding',include_in_schema=False)
    async def diagnostic(request: Request):
        c=config();headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
        if not enabled(c['host'],c['app'],c['database'],c['event']) or request.headers.get('Origin')!=c['app']:
            return JSONResponse(result('ORIGIN_REJECTED'),status_code=404,headers=headers)
        try:
            raw=bytearray()
            async for chunk in request.stream():
                raw.extend(chunk)
                if len(raw)>128:raise ValueError()
            body=json.loads(raw)
            if not isinstance(body,dict) or set(body)!={'invitation'}:raise ValueError()
            out=await asyncio.to_thread(inspect,c,request.headers.get('X-Notification-Device-Capability',''),body['invitation'])
        except Exception:
            out=result('INVALID_BODY')
        return JSONResponse(out,headers=headers)
