"""Two phases: observation, then guarded existing-installation reconciliation."""
import asyncio
import base64
import hashlib
import hmac
import json
import re
try:
    from backend import subscription_material as material
    from backend import subscription_provider as provider
except ModuleNotFoundError:
    import subscription_material as material
    import subscription_provider as provider

STATES = frozenset(('INELIGIBLE','OFFLINE_PENDING','CHECK_DUE','SDK_SETTLING','COMPARING','VERIFIED',
    'MISMATCH','PATCH_PENDING','VERIFYING','OUTCOME_UNKNOWN','DEFERRED','IDENTITY_UNRESOLVED'))
OUTCOMES = frozenset(('DISABLED','CIRCUIT_OPEN','RATE_LIMIT','STALE_GENERATION','LEASE_LOST','AUTH','BILLING',
    'POLICY','NETWORK','PROVIDER','DATA','IDENTITY','OPT_OUT','OS_HIDDEN','READINESS_UNKNOWN','KEY_MISMATCH','MISMATCH','UNCERTAIN'))


def safe(value):
    result = {'status': value.get('status') if value.get('status') in STATES else 'DEFERRED'}
    for name in ('subscription_verified_at','verification_expires_at','next_attempt_at'):
        v = value.get(name)
        if v is None or isinstance(v, str) and re.fullmatch(r'[0-9TZ:+. -]{10,40}', v):
            result[name] = v
    if type(value.get('generation')) is int and value['generation'] > 0:
        result['generation'] = value['generation']
    if value.get('outcome') in OUTCOMES:
        result['outcome'] = value['outcome']
    return result


def canonical_token(token):
    if not isinstance(token, dict) or set(token) != {'data','p256dh','auth','applicationServerKey'}:
        raise ValueError()
    result = {'data': material.endpoint_bytes(token['data']).decode()}
    for name, size in (('p256dh',65),('auth',16),('applicationServerKey',65)):
        result[name] = base64.urlsafe_b64encode(material.key_bytes(token[name],size)).decode().rstrip('=')
    return result


def fingerprint(token, credential, scope, owner):
    # Domain-separated key derivation; no additional deployed secret required.
    key = hmac.new(credential.encode(), b'ipm-reconciliation-key-v1', hashlib.sha256).digest()
    message = json.dumps([scope, owner, token], sort_keys=True, separators=(',',':')).encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def compare(body, token):
    try:
        stored = canonical_token({k: body['pushToken'][k] for k in token})
        return {k: hmac.compare_digest(stored[k], token[k]) for k in token}
    except Exception:
        return None


async def reconcile(*, client, event_slug, credential, scope, capability, payload):
    try:
        if not isinstance(payload, dict) or set(payload) - {'action','subscription','installation_id','permission','local_subscribed','user_id','generation'}:
            return safe({'status':'INELIGIBLE'})
        if (not isinstance(capability,str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}',capability)
                or not re.fullmatch(r'[A-Za-z0-9]{40}',payload.get('installation_id','')) or payload.get('user_id') is not None):
            return safe({'status':'IDENTITY_UNRESOLVED'})
        if payload.get('permission') != 'granted' or payload.get('local_subscribed') is not True:
            return safe({'status':'INELIGIBLE'})
        try:
            token = canonical_token(payload['subscription'])
        except Exception:
            return safe({'status':'INELIGIBLE','outcome':'DATA'})
        action = payload.get('action')
        if action not in ('check','confirm','invalidate') or not credential:
            return safe({'status':'INELIGIBLE'})
        owner = hashlib.sha256(capability.encode()).hexdigest()
        args = dict(capability_hash=owner, event_slug=event_slug, installation_id=payload['installation_id'],
                    fingerprint=fingerprint(token,credential,scope+':'+event_slug+':'+payload['installation_id'],owner))
        async def rpc(action, **kwargs):
            # RPC POST body keeps identifiers/fingerprints out of HTTP URL logs.
            return await client.request('POST','/rpc/ipm_reconciliation',json={'p':{**args,'action':action,**kwargs}})
        if action in ('confirm','invalidate'):
            generation = payload.get('generation')
            if type(generation) is not int or generation < 1:
                return safe({'status':'CHECK_DUE'})
            return safe(await rpc(action,generation=generation))
        expected = payload.get('generation', 1)
        if type(expected) is not int or expected < 1:
            return safe({'status':'CHECK_DUE'})
        claim = await rpc('claim',generation=expected)
        if claim.get('status') != 'COMPARING' or not claim.get('operation_id'):
            return safe(claim)
        fence = dict(generation=claim['generation'],operation_id=claim['operation_id'])
        async def finish(status, **details):
            return safe(await rpc('finish', **fence, status=status, **details))
        async def read():
            return await asyncio.to_thread(provider.read_installation,claim['target'],credential)
        try:
            body = await read()
            matches = compare(body,token)
            prefs = body.get('preferences',{})
            ready = (prefs.get('subscriptionStatus')=='optIn' and prefs.get('subscribedToNotifications') is True
                     and prefs.get('osNotificationsVisible') is True)
            if prefs.get('subscriptionStatus') == 'optOut' or prefs.get('subscribedToNotifications') is False:
                return await finish('INELIGIBLE',outcome='OPT_OUT',provider_ready=False)
            if prefs.get('osNotificationsVisible') is False:
                return await finish('INELIGIBLE',outcome='OS_HIDDEN',provider_ready=False)
            if not ready:
                return await finish('DEFERRED',outcome='READINESS_UNKNOWN',provider_ready=False)
            if matches is None:
                return await finish('DEFERRED',outcome='DATA',provider_ready=True)
            if all(matches.values()):
                return await finish('VERIFYING',provider_ready=True)
            if not matches['applicationServerKey']:
                return await finish('INELIGIBLE',outcome='KEY_MISMATCH',provider_ready=True)
            if claim.get('uncertain'):
                return await finish('OUTCOME_UNKNOWN',outcome='UNCERTAIN',provider_ready=True)
            if not claim.get('repair_enabled'):
                return await finish('MISMATCH',outcome='MISMATCH',provider_ready=True)
            # Atomic generation/operation fence immediately before external mutation.
            permission = await rpc('patch',**fence)
            if permission.get('status') != 'PATCH_PENDING':
                return safe(permission)
            claim['uncertain'] = True
            before_token = canonical_token({k: body['pushToken'][k] for k in token})
            patch_failure = None
            try:
                await asyncio.to_thread(provider.patch_installation,claim['target'],credential,token)
            except provider.ProviderFailure as error:
                patch_failure = error
            # Even a timeout may mean applied: read once, never retry mutation.
            body = await read()
            matches = compare(body,token)
            prefs = body.get('preferences',{})
            ready = prefs.get('subscriptionStatus')=='optIn' and prefs.get('subscribedToNotifications') is True and prefs.get('osNotificationsVisible') is True
            if matches and all(matches.values()) and ready:
                return await finish('VERIFYING',provider_ready=True)
            unchanged = compare(body,before_token)
            if patch_failure and patch_failure.not_applied and unchanged and all(unchanged.values()):
                return await finish('DEFERRED',outcome=patch_failure.classification,
                    retry_after=patch_failure.retry_after,clear_uncertain=True,provider_ready=ready)
            return await finish('OUTCOME_UNKNOWN',outcome=patch_failure.classification if patch_failure else 'UNCERTAIN',
                retry_after=patch_failure.retry_after if patch_failure else 0,provider_ready=ready)
        except provider.ProviderFailure as error:
            return await finish('OUTCOME_UNKNOWN' if permission_started(claim) else 'DEFERRED',
                outcome=error.classification,retry_after=error.retry_after)
    except Exception:
        # Database/network failures never disclose exception messages or payloads.
        return safe({'status':'DEFERRED','outcome':'NETWORK'})


def permission_started(claim):
    return claim.get('uncertain',False)
