"""Production-only pilot transport; identifiers remain in private RPC bodies."""
import hashlib
import json
import re
from fastapi import Request
from fastapi.responses import JSONResponse
try:
    from backend.production_push_diagnostic import enabled
    from backend.subscription_reconciliation import reconcile, safe
except ModuleNotFoundError:
    from production_push_diagnostic import enabled
    from subscription_reconciliation import reconcile, safe


def install_routes(router, config):
    def active(c):
        return enabled(c['host'], c['app'], c['database'], c['event'])

    def response(body, status=200):
        return JSONResponse(body, status_code=status, headers={
            'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'})

    @router.get('/notification-registrations/reconciliation-health', include_in_schema=False)
    async def health():
        c = config()
        if not active(c):
            return response({'detail': 'Not found'}, 404)
        out = {'component': 'PRODUCTION_RECONCILIATION_PILOT_V1',
               'build_commit': c['commit'] if re.fullmatch(r'[0-9a-f]{40}', c['commit']) else 'UNKNOWN',
               'pilot_only': True, 'pilot_restriction_count': 0,
               'observation_enabled': False, 'repair_enabled': False, 'metadata_read': 'FAILED'}
        try:
            rows = await c['client'].request('GET', '/notification_reconciliation_project',
                params={'select': 'enabled,repair_enabled,pilot_registration_id', 'limit': '2'})
            if len(rows) != 1:
                raise ValueError()
            row = rows[0]
            count = int(bool(row.get('pilot_registration_id')))
            out.update(pilot_restriction_count=count,
                       observation_enabled=count == 1 and row.get('enabled') is True,
                       repair_enabled=count == 1 and row.get('enabled') is True and row.get('repair_enabled') is True,
                       metadata_read='SUCCESS')
        except Exception:
            pass
        return response(out)

    @router.post('/notification-registrations/pilot-eligibility', include_in_schema=False)
    async def eligibility(request: Request):
        c = config()
        if not active(c) or request.headers.get('Origin') != c['app']:
            return response({'detail': 'Not found'}, 404)
        capability = request.headers.get('X-Notification-Device-Capability', '')
        if not re.fullmatch(r'[A-Za-z0-9_-]{43}', capability):
            return response({'pilot_eligible': False})
        try:
            result = await c['client'].request('POST', '/rpc/ipm_reconciliation', json={'p': {
                'action': 'eligibility', 'event_slug': c['event'],
                'capability_hash': hashlib.sha256(capability.encode()).hexdigest()}})
            if type(result.get('pilot_eligible')) is not bool:
                raise ValueError()
            return response({k: result.get(k) is True for k in
                             ('pilot_eligible', 'observation_enabled', 'repair_enabled')})
        except Exception:
            return response({'status': 'DEFERRED'}, 503)

    @router.post('/notification-registrations/bind-pilot', include_in_schema=False)
    async def bind_pilot(request: Request):
        c = config()
        if not active(c) or request.headers.get('Origin') != c['app']:
            return response({'bound': False}, 404)
        capability = request.headers.get('X-Notification-Device-Capability', '')
        if not re.fullmatch(r'[A-Za-z0-9_-]{43}', capability):
            return response({'bound': False}, 404)
        try:
            raw = bytearray()
            async for chunk in request.stream():
                raw.extend(chunk)
                if len(raw) > 128:
                    return response({'bound': False}, 404)
            body = json.loads(raw)
            if (not isinstance(body, dict) or set(body) != {'invitation'}
                    or not isinstance(body['invitation'], str)
                    or not re.fullmatch(r'[A-Za-z0-9_-]{43}', body['invitation'])):
                return response({'bound': False}, 404)
            result = await c['client'].request('POST', '/rpc/ipm_bind_reconciliation_pilot', json={'p': {
                'event_slug': c['event'],
                'capability_hash': hashlib.sha256(capability.encode()).hexdigest(),
                'invitation_hash': hashlib.sha256(body['invitation'].encode()).hexdigest()}})
            if (result.get('bound') is True and type(result.get('pilot_restriction_count')) is int
                    and result['pilot_restriction_count'] == 1
                    and result.get('observation_enabled') is False
                    and result.get('repair_enabled') is False):
                return response({'bound': True, 'pilot_restriction_count': 1,
                                 'observation_enabled': False, 'repair_enabled': False})
            return response({'bound': False}, 404)
        except Exception:
            # Ambiguous commit: do not retry or expose transport errors/secrets.
            return response({'bound': False}, 503)

    @router.post('/notification-registrations/bind-controlled-target', include_in_schema=False)
    async def bind_controlled_target(request: Request):
        c = config()
        if not active(c) or request.headers.get('Origin') != c['app']:
            return response({'reason': 'ORIGIN_REJECTED'}, 404)
        capability = request.headers.get('X-Notification-Device-Capability', '')
        if not re.fullmatch(r'[A-Za-z0-9_-]{43}', capability):
            return response({'reason': 'CAPABILITY_INVALID'})
        targets = c.get('targets', [])
        if not isinstance(targets, list) or len(targets) != 1:
            return response({'reason': 'CONTROLLED_TARGET_COUNT'})
        target = targets[0]
        if not isinstance(target, str) or not re.fullmatch(r'[A-Za-z0-9]{40}', target):
            return response({'reason': 'CONTROLLED_TARGET_INVALID'})
        try:
            result = await c['client'].request('POST', '/rpc/ipm_bind_controlled_target', json={'p': {
                'event_slug': c['event'],
                'capability_hash': hashlib.sha256(capability.encode()).hexdigest(),
                'controlled_target': target}})
            if (result.get('bound') is True
                    and result.get('pilot_restriction_count') == 1
                    and result.get('controlled_target_count') == 1
                    and result.get('controlled_target_match') is True
                    and result.get('observation_enabled') is False
                    and result.get('repair_enabled') is False):
                return response({'bound': True, 'pilot_restriction_count': 1,
                                 'controlled_target_count': 1,
                                 'controlled_target_match': True,
                                 'observation_enabled': False, 'repair_enabled': False})
            reason = result.get('reason')
            if not isinstance(reason, str) or not re.fullmatch(r'[A-Z_]{3,64}', reason):
                reason = 'UNAVAILABLE'
            return response({'reason': reason})
        except Exception:
            return response({'reason': 'UNAVAILABLE'}, 503)

    @router.post('/notification-registrations/reconcile', include_in_schema=False)
    async def reconcile_request(request: Request):
        c = config()
        if not active(c) or request.headers.get('Origin') != c['app']:
            return response({'detail': 'Not found'}, 404)
        try:
            body = bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body) > 12288:
                    return response(safe({'status': 'INELIGIBLE'}))
            result = await reconcile(client=c['client'], event_slug=c['event'],
                credential=c['credential'], scope=c['database'],
                capability=request.headers.get('X-Notification-Device-Capability', ''),
                payload=json.loads(body))
        except Exception:
            result = safe({'status': 'DEFERRED'})
        return response(result)
