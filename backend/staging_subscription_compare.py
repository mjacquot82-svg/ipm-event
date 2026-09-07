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

RESULT = "CURRENT_BROWSER_SUBSCRIPTION_MATCHES_PROVIDER"
FIELDS = ("endpoint", "p256dh", "auth", "application_server_key")
PROVIDER_FIELDS = ("pushToken.data", "pushToken.p256dh", "pushToken.auth", "pushToken.applicationServerKey")
DOMAIN = b"ipm-subscription-compare-v1\0"


def unverifiable():
    return {RESULT: "unverifiable"}


def valid_payload(payload):
    if not isinstance(payload, dict) or set(payload) != {"challenge", "digests"}:
        return False
    def digest(value):
        return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None
    return (digest(payload["challenge"]) and isinstance(payload["digests"], dict)
            and set(payload["digests"]) == set(FIELDS)
            and all(digest(value) for value in payload["digests"].values()))


def key_bytes(value, size):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]+={0,2}", value):
        raise ValueError()
    bare = value.rstrip("=")
    decoded = base64.b64decode(bare + "=" * (-len(bare) % 4), altchars=b"-_", validate=True)
    # Decode to bytes, then reject noncanonical encodings (including pad bits).
    if base64.urlsafe_b64encode(decoded).decode().rstrip("=") != bare or len(decoded) != size:
        raise ValueError()
    if value != bare and value != bare + "=" * (-len(bare) % 4):
        raise ValueError()
    if size == 65 and decoded[0] != 4:
        raise ValueError()
    return decoded


def endpoint_bytes(value):
    if not isinstance(value, str) or not re.fullmatch(r"[\x21-\x7e]{1,8192}", value):
        raise ValueError()
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError()
    # Compare the full, exact endpoint; do not trim or rewrite opaque tokens.
    return value.encode("utf-8")


def field_digest(challenge, field, value):
    return hmac.new(bytes.fromhex(challenge), DOMAIN + field.encode("ascii") + b"\0" + value, hashlib.sha256).hexdigest()


def compare_body(body, payload):
    try:
        token = body["pushToken"]
        values = {
            "endpoint": endpoint_bytes(token["data"]),
            "p256dh": key_bytes(token["p256dh"], 65),
            "auth": key_bytes(token["auth"], 16),
            "application_server_key": key_bytes(token["applicationServerKey"], 65),
        }
        matches = {field + "_match": hmac.compare_digest(
            field_digest(payload["challenge"], field, values[field]), payload["digests"][field]) for field in FIELDS}
        return {RESULT: all(matches.values()), **matches}
    except Exception:
        # Missing, malformed or unrepresentable material is not a mismatch.
        return unverifiable()


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
