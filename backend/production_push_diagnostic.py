"""Temporary production diagnostic: two private GETs, no writes or retries."""
import hashlib
import hmac
import json
import re
from datetime import datetime
from urllib.parse import urlencode, quote
from urllib.request import Request, build_opener, HTTPRedirectHandler
try:
    from backend.production_push_material import valid_payload, compare_body, RESULT, PROVIDER_FIELDS
except ModuleNotFoundError:
    from production_push_material import valid_payload, compare_body, RESULT, PROVIDER_FIELDS

BOOL_FIELDS = ('production_registration_identified', 'browser_subscription_present', 'browser_provider_match',
 'endpoint_match','p256dh_match','auth_match','application_server_key_match',
 'configured_test_target_matches_current_registration','provider_opt_in','provider_has_push_token',
 'provider_os_notifications_visible')

def result(status='UNVERIFIABLE', count=0):
    return {**{k:'unverifiable' for k in BOOL_FIELDS}, 'configured_test_target_count':count,
            'provider_update_at':'unavailable','diagnostic_status':status}

def enabled(host, app, database, event):
    return (host == 'ipm-backend-eoiw.onrender.com' and app == 'https://theipm.ca'
        and database == 'https://hppboivlpqkfhhzfftuu.supabase.co' and event == 'ipm-2026')

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def read_json(url, headers):
    # urllib avoids application's HTTPX INFO logging of private query URLs.
    # Never attach exception messages, URLs or bodies to logs/responses.
    try:
        with build_opener(NoRedirect()).open(Request(url, headers=headers, method='GET'), timeout=15) as response:
            if response.status != 200:
                raise ValueError()
            raw = response.read(65537)
            if len(raw)>65536:
                raise ValueError()
            return json.loads(raw)
    except Exception as error:
        close=getattr(error,'close',None)
        if callable(close): close()
        raise ValueError('READ_UNAVAILABLE') from None

def inspect(*, capability, payload, database, database_key, credential, targets, read=read_json):
    out=result(count=len(targets))
    if not isinstance(capability,str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}',capability):
        out['diagnostic_status']='CAPABILITY_UNAVAILABLE'; return out
    if not valid_payload(payload):
        out['diagnostic_status']='INVALID_INPUT'; return out
    if not database_key or not credential:
        out['diagnostic_status']='CONFIGURATION_UNAVAILABLE'; return out
    out['browser_subscription_present']=True
    query=urlencode({'select':'wonderpush_installation_id,events!inner(slug)',
        'events.slug':'eq.ipm-2026','capability_hash':'eq.'+hashlib.sha256(capability.encode()).hexdigest(),'limit':'2'})
    try:
        rows=read(database+'/rest/v1/notification_installations?'+query,
                  {'apikey':database_key,'Authorization':'Bearer '+database_key,'Accept':'application/json'})
    except Exception:
        out['diagnostic_status']='REGISTRATION_READ_UNAVAILABLE'; return out
    if not isinstance(rows,list) or len(rows)!=1:
        out['production_registration_identified']=False
        out['diagnostic_status']='REGISTRATION_UNRESOLVED'; return out
    target=rows[0].get('wonderpush_installation_id')
    if not isinstance(target,str) or not re.fullmatch(r'[A-Za-z0-9]{40}',target):
        out['diagnostic_status']='REGISTRATION_UNRESOLVED'; return out
    out['production_registration_identified']=True
    out['configured_test_target_matches_current_registration']=(len(targets)==1 and hmac.compare_digest(target,targets[0]))
    fields=(*PROVIDER_FIELDS,'preferences.subscriptionStatus','preferences.subscribedToNotifications',
            'preferences.osNotificationsVisible','updateDate')
    query=urlencode({'accessToken':credential,'userId':'','fields':','.join(fields)})
    try:
        body=read('https://management-api.wonderpush.com/v1/installations/'+quote(target,safe='')+'?'+query,
                  {'Accept':'application/json'})
        if not isinstance(body,dict): raise ValueError()
        compared=compare_body(body,payload)
        out['browser_provider_match']=compared[RESULT]
        for k in ('endpoint_match','p256dh_match','auth_match','application_server_key_match'):
            out[k]=compared.get(k,'unverifiable')
        token=body.get('pushToken')
        if isinstance(token,dict): out['provider_has_push_token']=isinstance(token.get('data'),str) and bool(token['data'])
        prefs=body.get('preferences')
        if isinstance(prefs,dict):
            status=prefs.get('subscriptionStatus')
            if status in ('optIn','optOut'):out['provider_opt_in']=status=='optIn' and prefs.get('subscribedToNotifications') is not False
            if type(prefs.get('osNotificationsVisible')) is bool:out['provider_os_notifications_visible']=prefs['osNotificationsVisible']
        stamp=body.get('updateDate')
        if isinstance(stamp,str) and re.fullmatch(r'[0-9T:Z.+-]{20,35}',stamp):
            parsed=datetime.fromisoformat(stamp.replace('Z','+00:00'))
            if parsed.tzinfo:out['provider_update_at']=parsed.isoformat()
        out['diagnostic_status']='COMPARED' if type(out['browser_provider_match']) is bool else 'PROVIDER_DATA_UNVERIFIABLE'
    except Exception:
        out['diagnostic_status']='PROVIDER_READ_UNAVAILABLE'
    return out


def install_routes(router, config):
    import asyncio
    from fastapi import Request
    from fastapi.responses import JSONResponse
    @router.post('/production-diagnostics/push-target', include_in_schema=False)
    async def production_push_target(request: Request):
        c=config()
        headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
        if not enabled(c['host'],c['app'],c['database'],c['event']):
            return JSONResponse({'detail':'Not found'},status_code=404,headers=headers)
        if request.headers.get('origin')!='https://theipm.ca':
            return JSONResponse(result('ORIGIN_REJECTED'),status_code=403,headers=headers)
        try:
            raw=bytearray()
            async for chunk in request.stream():
                raw.extend(chunk)
                if len(raw)>2048:raise ValueError()
            payload=json.loads(raw)
            response=await asyncio.to_thread(inspect, capability=request.headers.get('X-Notification-Device-Capability',''),
                payload=payload,database=c['database'],database_key=c['database_key'],credential=c['credential'],targets=c['targets'])
        except Exception:
            response=result('INVALID_INPUT')
        return JSONResponse(response,headers=headers)
