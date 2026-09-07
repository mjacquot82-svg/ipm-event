"""Temporary read-only WonderPush projection, restricted to IPM staging resources."""
from datetime import datetime, timezone
import asyncio
import json
import math
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import HTTPException

STAGING_HOST = "ipm-staging-backend.onrender.com"
STAGING_APP = "https://staging.theipm.ca"
STAGING_DATABASE = "https://hooiqjcbcbwzjjvnwyxf.supabase.co"
PROVIDER_FIELDS = (
    "updateDate",
    "pushToken.meta.updateDate",
    "pushToken.expirationDate",
    "preferences.subscriptionStatus",
    "preferences.subscribedToNotifications",
    "preferences.osNotificationsVisible",
)


def enabled(*, render_hostname, public_app_url, supabase_url):
    # Server configuration only: request Host/Origin cannot enable this route.
    return (
        render_hostname == STAGING_HOST
        and public_app_url == STAGING_APP
        and supabase_url.rstrip("/") == STAGING_DATABASE
    )


def failed(classification, status=None):
    return {
        "provider_installation_read": "FAILED",
        "installation_update_at": "UNKNOWN",
        "push_token_update_at": "UNKNOWN",
        "push_token_expiration_at": "UNKNOWN",
        "subscription_status": "UNKNOWN",
        "subscribed_to_notifications": "UNKNOWN",
        "os_notifications_visible": "UNKNOWN",
        "provider_http_status": status,
        "error_classification": classification,
    }


def timestamp(value):
    # WonderPush documents millisecond epoch timestamps. Do not echo strings.
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return "UNKNOWN"
    if not math.isfinite(value):
        return "UNKNOWN"
    try:
        return datetime.fromtimestamp(value / 1000, timezone.utc).isoformat().replace("+00:00", "Z")
    except (ValueError, OverflowError, OSError):
        return "UNKNOWN"


def sanitize(body):
    if not isinstance(body, dict):
        return failed("MALFORMED_RESPONSE", 200)
    token = body.get("pushToken")
    token = token if isinstance(token, dict) else {}
    meta = token.get("meta")
    meta = meta if isinstance(meta, dict) else {}
    preferences = body.get("preferences")
    preferences = preferences if isinstance(preferences, dict) else {}
    subscription = preferences.get("subscriptionStatus")
    return {
        "provider_installation_read": "SUCCESS",
        "installation_update_at": timestamp(body.get("updateDate")),
        "push_token_update_at": timestamp(meta.get("updateDate")),
        "push_token_expiration_at": "NONE" if token.get("expirationDate") is None else timestamp(token["expirationDate"]),
        "subscription_status": subscription if subscription in ("optIn", "optOut") else "UNKNOWN",
        "subscribed_to_notifications": preferences.get("subscribedToNotifications") if type(preferences.get("subscribedToNotifications")) is bool else "UNKNOWN",
        "os_notifications_visible": preferences.get("osNotificationsVisible") if type(preferences.get("osNotificationsVisible")) is bool else "UNKNOWN",
    }


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def provider_get(installation_id, credential):
    """One GET, no redirects/retries; never log request URLs or exceptions.

    urllib avoids the application's HTTPX INFO request logger, which includes
    provider URLs. Authentication and the target stay inside this function.
    """
    query = urlencode({"accessToken": credential, "userId": "", "fields": ",".join(PROVIDER_FIELDS)})
    request = Request(
        "https://management-api.wonderpush.com/v1/installations/"
        + quote(installation_id, safe="") + "?" + query,
        method="GET", headers={"Accept": "application/json"},
    )
    try:
        with build_opener(NoRedirect()).open(request, timeout=25) as response:
            if response.status != 200:
                return failed("PROVIDER_HTTP_ERROR", response.status)
            # Bound parsing and discard unselected values even if the provider
            # unexpectedly returns extra fields. Never include the raw body.
            raw = response.read(65537)
            if len(raw) > 65536:
                return failed("RESPONSE_TOO_LARGE", 200)
            try:
                return sanitize(json.loads(raw))
            except (ValueError, UnicodeError):
                return failed("MALFORMED_RESPONSE", 200)
    except HTTPError as error:
        status = error.code if isinstance(error.code, int) and 100 <= error.code <= 599 else None
        error.close()
        return failed("PROVIDER_HTTP_ERROR", status)
    except TimeoutError:
        return failed("PROVIDER_TIMEOUT")
    except URLError as error:
        return failed("PROVIDER_TIMEOUT" if isinstance(error.reason, TimeoutError) else "PROVIDER_NETWORK_ERROR")
    except Exception:
        return failed("PROVIDER_READ_ERROR")


async def read_current(*, render_hostname, public_app_url, supabase_url, repository, credential):
    if not enabled(render_hostname=render_hostname, public_app_url=public_app_url, supabase_url=supabase_url):
        raise HTTPException(status_code=404, detail="Not found")
    if repository is None or not credential:
        return failed("STAGING_CONFIGURATION_UNAVAILABLE")
    try:
        # Read only the internal target, not capability, push token or a whole row.
        # Two rows are enough to detect ambiguity; never choose a 'newest' target.
        rows = await repository.client.request("GET", "/notification_installations", params={
            "select": "wonderpush_installation_id", "limit": "2",
        })
    except Exception:
        return failed("REGISTRATION_READ_FAILED")
    if not isinstance(rows, list) or len(rows) != 1:
        return failed("SINGLE_REGISTRATION_REQUIRED")
    target = rows[0].get("wonderpush_installation_id") if isinstance(rows[0], dict) else None
    if not isinstance(target, str) or not re.fullmatch(r"[A-Za-z0-9]{40}", target):
        return failed("REGISTRATION_TARGET_INVALID")
    return await asyncio.to_thread(provider_get, target, credential)
