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
        out = {'component': 'PRODUCTION_RECONCILIATION_V2',
               'build_commit': c['commit'] if re.fullmatch(r'[0-9a-f]{40}', c['commit']) else 'UNKNOWN',
               'pilot_only': True, 'pilot_restriction_count': 0,
               'operating_mode': 'PILOT', 'repair_cohort_percent': 0,
               'metadata_rows': 0, 'status_counts': {}, 'active_leases': 0,
               'pending_retries': 0, 'uncertain_outcomes': 0,
               'provider_ready_count': 0, 'failure_count': 0,
               'circuit_open': False, 'observation_enabled': False,
               'repair_enabled': False, 'metadata_read': 'FAILED'}
        try:
            rows = await c['client'].request('GET', '/notification_reconciliation_project',
                params={'select': 'enabled,repair_enabled,pilot_registration_id,mode,repair_cohort_percent,open_until', 'limit': '2'})
            if len(rows) != 1:
                raise ValueError()
            row = rows[0]
            mode = row.get('mode') if row.get('mode') in ('PILOT','POPULATION_OBSERVE','POPULATION_REPAIR_STAGED') else 'PILOT'
            cohort = row.get('repair_cohort_percent') if isinstance(row.get('repair_cohort_percent'), int) else 0
            metadata = await c['client'].request('GET', '/notification_reconciliation',
                params={'select': 'status,lease_until,next_attempt_at,uncertain,provider_ready,failures', 'limit': '1000'})
            status_counts = {}
            active_leases = pending_retries = uncertain = provider_ready = failures = 0
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            for item in metadata if isinstance(metadata, list) else []:
                status = item.get('status')
                if isinstance(status, str) and re.fullmatch(r'[A-Z_]{3,32}', status):
                    status_counts[status] = status_counts.get(status, 0) + 1
                lease = item.get('lease_until')
                retry = item.get('next_attempt_at')
                try:
                    if isinstance(lease, str) and datetime.fromisoformat(lease.replace('Z', '+00:00')) > now:
                        active_leases += 1
                except Exception:
                    pass
                try:
                    if isinstance(retry, str) and datetime.fromisoformat(retry.replace('Z', '+00:00')) > now:
                        pending_retries += 1
                except Exception:
                    pass
                uncertain += int(item.get('uncertain') is True)
                provider_ready += int(item.get('provider_ready') is True)
                failures += item.get('failures', 0) if isinstance(item.get('failures'), int) and item.get('failures', 0) > 0 else 0
            count = int(bool(row.get('pilot_registration_id')))
            out.update(pilot_restriction_count=count, operating_mode=mode,
                       pilot_only=mode == 'PILOT', repair_cohort_percent=max(0, min(100, cohort)),
                       metadata_rows=len(metadata) if isinstance(metadata, list) else 0,
                       status_counts=status_counts, active_leases=active_leases,
                       pending_retries=pending_retries, uncertain_outcomes=uncertain,
                       provider_ready_count=provider_ready, failure_count=failures,
                       circuit_open=isinstance(row.get('open_until'), str),
                       observation_enabled=row.get('enabled') is True,
                       repair_enabled=row.get('enabled') is True and row.get('repair_enabled') is True,
                       metadata_read='SUCCESS')
        except Exception:
            pass
        return response(out)

    @router.post('/notification-registrations/support-reference', include_in_schema=False)
    async def support_reference(request: Request):
        c = config()
        if not active(c) or request.headers.get('Origin') != c['app']:
            return response({}, 404)
        capability = request.headers.get('X-Notification-Device-Capability', '')
        if not re.fullmatch(r'[A-Za-z0-9_-]{43}', capability):
            return response({}, 404)
        # No browser-selected identity or body is accepted. Private RPC POST
        # prevents capability hashes / installation IDs entering URL logs.
        async for chunk in request.stream():
            if chunk:
                return response({}, 400)
        try:
            result = await c['client'].request('POST', '/rpc/ipm_staff_validation_reference', json={'p': {
                'event_slug': c['event'],
                'capability_hash': hashlib.sha256(capability.encode()).hexdigest()}})
            reference = result.get('reference')
            if isinstance(reference, str) and re.fullmatch(r'[A-F0-9]{10}', reference):
                return response({'reference': reference})
            return response({}, 404)
        except Exception:
            return response({}, 503)

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
