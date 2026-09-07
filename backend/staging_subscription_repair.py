"""Temporary capability-authorized staging repair of an EXISTING installation.

No SDK calls, subscription creation, database writes, sends or automatic retries.
Sensitive request/response material is used privately in memory only.
"""
import asyncio
import base64
import json
import re
from urllib.parse import quote, urlencode
from urllib.request import Request, build_opener

from fastapi import HTTPException

try:
    from backend import staging_subscription_compare as comparison
    from backend.notification_registrations import capability_matches
except ModuleNotFoundError:
    import staging_subscription_compare as comparison
    from notification_registrations import capability_matches

_lock = asyncio.Lock()
_attempted = False


def result(status, compared=None):
    return {"repair_status": status, **(compared or comparison.unverifiable())}


def validate(payload):
    if not isinstance(payload, dict) or set(payload) != {"subscription", "comparison"}:
        raise ValueError()
    token = payload["subscription"]
    if not isinstance(token, dict) or set(token) != {"data", "p256dh", "auth", "applicationServerKey"}:
        raise ValueError()
    if not comparison.valid_payload(payload["comparison"]):
        raise ValueError()
    comparison.endpoint_bytes(token["data"])
    canonical = {"data": token["data"]}
    for field, size in (("p256dh", 65), ("auth", 16), ("applicationServerKey", 65)):
        canonical[field] = base64.urlsafe_b64encode(comparison.key_bytes(token[field], size)).decode().rstrip("=")
    if comparison.compare_body({"pushToken": canonical}, payload["comparison"])[comparison.RESULT] is not True:
        raise ValueError()
    return canonical


def read_token(target, credential):
    query = urlencode({"accessToken": credential, "userId": "", "fields": ",".join(comparison.PROVIDER_FIELDS)})
    request = Request("https://management-api.wonderpush.com/v1/installations/" + quote(target, safe="")
                      + "?" + query, method="GET", headers={"Accept": "application/json"})
    with build_opener(comparison.NoRedirect()).open(request, timeout=25) as response:
        if response.status != 200:
            raise ValueError()
        raw = response.read(65537)
        if len(raw) > 65536:
            raise ValueError()
        return json.loads(raw)


def patch_token(target, credential, token):
    # Documented PATCH updates an existing installation. Never PUT/POST/upsert.
    # Credential and token go in the TLS request body, never a logged URL.
    data = json.dumps({"accessToken": credential, "userId": "", "body": {"pushToken": token}}).encode()
    request = Request("https://management-api.wonderpush.com/v1/installations/" + quote(target, safe=""),
                      data=data, method="PATCH", headers={"Content-Type": "application/json"})
    with build_opener(comparison.NoRedirect()).open(request, timeout=25) as response:
        if response.status != 200:
            raise ValueError()
        # Never read or return the provider mutation response body.


def reconcile(target, credential, token, payload):
    global _attempted
    try:
        before = comparison.compare_body(read_token(target, credential), payload)
        if before[comparison.RESULT] is True:
            return result("ALREADY_MATCHED", before)
        expected = {comparison.RESULT: False, "endpoint_match": False, "p256dh_match": False,
                    "auth_match": False, "application_server_key_match": True}
        if before != expected:
            return result("PRECONDITION_NOT_MET", before)
        if _attempted:
            return result("ATTEMPT_ALREADY_USED", before)
        _attempted = True  # Ambiguous PATCH failure must never trigger an automatic retry.
        try:
            patch_token(target, credential, token)
        except Exception as error:
            close = getattr(error, "close", None)
            if callable(close):
                close()
            # A timeout can occur after application. A single read is safe;
            # never repeat the PATCH, regardless of its HTTP outcome.
        after = comparison.compare_body(read_token(target, credential), payload)
        return result("MATCH_VERIFIED" if after[comparison.RESULT] is True else "OUTCOME_UNCONFIRMED", after)
    except Exception as error:
        close = getattr(error, "close", None)
        if callable(close):
            close()
        return result("OUTCOME_UNCONFIRMED" if _attempted else "READ_FAILED")


async def repair_current(*, render_hostname, public_app_url, supabase_url, repository, credential, capability, payload):
    if not comparison.enabled(render_hostname=render_hostname, public_app_url=public_app_url, supabase_url=supabase_url):
        raise HTTPException(status_code=404, detail="Not found")
    try:
        token = validate(payload)
        if not isinstance(capability, str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", capability) or not credential or repository is None:
            return result("NOT_AUTHORIZED")
        async with _lock:
            rows = await repository.client.request("GET", "/notification_installations", params={
                "select": "wonderpush_installation_id,capability_hash", "limit": "2",
            })
            if not isinstance(rows, list) or len(rows) != 1:
                return result("NOT_AUTHORIZED")
            row = rows[0]
            target = row.get("wonderpush_installation_id")
            if (not isinstance(target, str) or not re.fullmatch(r"[A-Za-z0-9]{40}", target)
                    or not capability_matches(capability, row.get("capability_hash", ""))):
                return result("NOT_AUTHORIZED")
            return await asyncio.to_thread(reconcile, target, credential, token, payload["comparison"])
    except Exception:
        return result("UNVERIFIABLE")
