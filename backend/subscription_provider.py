"""Private, single-attempt provider transport. Never log URLs, bodies or exceptions."""
import json
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler
try:
    from backend.subscription_material import PROVIDER_FIELDS
except ModuleNotFoundError:
    from subscription_material import PROVIDER_FIELDS


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class ProviderFailure(Exception):
    def __init__(self, classification, retry_after=0, not_applied=False):
        super().__init__(classification)
        self.classification = classification
        self.retry_after = retry_after
        self.not_applied = not_applied


def retry_seconds(value):
    try:
        return max(0, min(86400, int(value)))
    except (TypeError, ValueError):
        try:
            return max(0, min(86400, int((parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())))
        except Exception:
            return 0


def patch_request(target, credential, token):
    return Request('https://management-api.wonderpush.com/v1/installations/' + quote(target, safe=''),
        data=json.dumps({'accessToken': credential, 'userId': '', 'body': {'pushToken': token}}).encode(),
        method='PATCH', headers={'Content-Type': 'application/json'})


def exchange(request, read):
    try:
        with build_opener(NoRedirect()).open(request, timeout=20) as response:
            if response.status != 200:
                raise ProviderFailure('PROVIDER')
            if not read:
                return None
            raw = response.read(65537)
            if len(raw) > 65536:
                raise ProviderFailure('DATA')
            return json.loads(raw)
    except ProviderFailure:
        raise
    except HTTPError as error:
        status = error.code
        retry = retry_seconds(error.headers.get('Retry-After'))
        error.close()
        classification = {401:'AUTH', 402:'BILLING', 403:'POLICY', 404:'IDENTITY', 429:'RATE_LIMIT'}.get(status, 'PROVIDER' if status >= 500 else 'DATA')
        raise ProviderFailure(classification, retry, status in (400,401,402,403,404,429)) from None
    except Exception:
        raise ProviderFailure('NETWORK') from None


def read_installation(target, credential):
    fields = (*PROVIDER_FIELDS, 'preferences.subscriptionStatus', 'preferences.subscribedToNotifications', 'preferences.osNotificationsVisible')
    query = urlencode({'accessToken': credential, 'userId': '', 'fields': ','.join(fields)})
    return exchange(Request('https://management-api.wonderpush.com/v1/installations/' + quote(target, safe='') + '?' + query,
        method='GET', headers={'Accept': 'application/json'}), True)


def patch_installation(target, credential, token):
    exchange(patch_request(target, credential, token), False)
