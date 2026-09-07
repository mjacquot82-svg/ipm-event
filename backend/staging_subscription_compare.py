"""Temporary staging-only comparison. Sensitive subscription material stays in memory."""
import asyncio
import base64
import hashlib
import hmac
import json
import re
from urllib.parse import urlencode, quote, urlsplit
from urllib.request import Request, build_opener

from fastapi import HTTPException

try:
    from backend.staging_provider_diagnostic import enabled, NoRedirect
except ModuleNotFoundError:
    from staging_provider_diagnostic import enabled, NoRedirect

try:
    from backend.subscription_material import (RESULT, FIELDS, PROVIDER_FIELDS, DOMAIN, unverifiable,
        valid_payload, key_bytes, endpoint_bytes, field_digest, compare_body)
except ModuleNotFoundError:
    from subscription_material import (RESULT, FIELDS, PROVIDER_FIELDS, DOMAIN, unverifiable,
        valid_payload, key_bytes, endpoint_bytes, field_digest, compare_body)


def provider_compare(target, credential, payload):
    # One GET, no retries/redirects. Do not use the application's HTTPX request
    # logger: its INFO URL output could disclose credentials and the target.
    query = urlencode({"accessToken": credential, "userId": "", "fields": ",".join(PROVIDER_FIELDS)})
    request = Request("https://management-api.wonderpush.com/v1/installations/"
                      + quote(target, safe="") + "?" + query, method="GET", headers={"Accept": "application/json"})
    try:
        with build_opener(NoRedirect()).open(request, timeout=25) as response:
            if response.status != 200:
                return unverifiable()
            raw = response.read(65537)
            if len(raw) > 65536:
                return unverifiable()
            return compare_body(json.loads(raw), payload)
    except Exception as error:
        # No exception string, body, URL or material is logged or returned.
        close = getattr(error, "close", None)
        if callable(close):
            close()
        return unverifiable()


async def compare_current(*, render_hostname, public_app_url, supabase_url, repository, credential, payload):
    if not enabled(render_hostname=render_hostname, public_app_url=public_app_url, supabase_url=supabase_url):
        raise HTTPException(status_code=404, detail="Not found")
    if not valid_payload(payload) or repository is None or not credential:
        return unverifiable()
    try:
        rows = await repository.client.request("GET", "/notification_installations", params={
            "select": "wonderpush_installation_id", "limit": "2",
        })
        if not isinstance(rows, list) or len(rows) != 1:
            return unverifiable()
        target = rows[0].get("wonderpush_installation_id")
        if not isinstance(target, str) or not re.fullmatch(r"[A-Za-z0-9]{40}", target):
            return unverifiable()
        return await asyncio.to_thread(provider_compare, target, credential, payload)
    except Exception:
        return unverifiable()
