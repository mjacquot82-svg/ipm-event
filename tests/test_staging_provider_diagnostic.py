import asyncio
import io
import json
import os
import subprocess
import sys
from types import SimpleNamespace
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from backend import staging_provider_diagnostic as diagnostic

TARGET = "A" * 40
SECRET = "never-expose-this-credential"
SAFE_BODY = {
    "updateDate": 1788790000000,
    "pushToken": {"meta": {"updateDate": 1788520000000}, "expirationDate": None},
    "preferences": {"subscriptionStatus": "optIn", "subscribedToNotifications": True, "osNotificationsVisible": False},
}
CONFIG = dict(render_hostname=diagnostic.STAGING_HOST, public_app_url=diagnostic.STAGING_APP, supabase_url=diagnostic.STAGING_DATABASE)


class ReadOnlyDatabase:
    def __init__(self, rows=None):
        self.rows = rows if rows is not None else [{"wonderpush_installation_id": TARGET}]
        self.reads = 0

    async def request(self, method, path, **kwargs):
        assert method == "GET"
        assert path == "/notification_installations"
        assert kwargs == {"params": {"select": "wonderpush_installation_id", "limit": "2"}}
        self.reads += 1
        return self.rows


def run_read(database):
    return asyncio.run(diagnostic.read_current(**CONFIG, repository=SimpleNamespace(client=database), credential=SECRET))


@pytest.mark.parametrize("field,value", [
    ("render_hostname", "ipm-backend-eoiw.onrender.com"),
    ("render_hostname", ""),
    ("public_app_url", "https://theipm.ca"),
    ("supabase_url", "https://production.supabase.co"),
    ("public_app_url", "https://staging.theipm.ca.attacker.invalid"),
])
def test_production_and_mismatched_resources_never_read(field, value, monkeypatch):
    config = {**CONFIG, field: value}
    database = ReadOnlyDatabase()
    provider = Mock(side_effect=AssertionError("Provider must not be called"))
    monkeypatch.setattr(diagnostic, "provider_get", provider)
    with pytest.raises(HTTPException) as error:
        asyncio.run(diagnostic.read_current(**config, repository=SimpleNamespace(client=database), credential=SECRET))
    assert error.value.status_code == 404
    assert database.reads == 0
    provider.assert_not_called()


def test_exactly_one_provider_get_restricted_projection_no_mutation_or_secret_logs(monkeypatch, caplog):
    body = {**SAFE_BODY, "id": TARGET, "accessToken": SECRET,
        "pushToken": {**SAFE_BODY["pushToken"], "data": SECRET, "endpoint": SECRET, "auth": SECRET}, "unrelated": SECRET}
    class Response(io.BytesIO):
        status = 200
    calls = []
    def open_request(request, timeout):
        calls.append(request)
        assert request.method == "GET"
        assert timeout == 25
        url = urlsplit(request.full_url)
        assert url.hostname == "management-api.wonderpush.com"
        assert url.path.endswith("/" + TARGET)
        query = parse_qs(url.query, keep_blank_values=True)
        assert query == {"accessToken": [SECRET], "userId": [""], "fields": [",".join(diagnostic.PROVIDER_FIELDS)]}
        assert diagnostic.PROVIDER_FIELDS == (
            "updateDate", "pushToken.meta.updateDate", "pushToken.expirationDate",
            "preferences.subscriptionStatus", "preferences.subscribedToNotifications", "preferences.osNotificationsVisible",
        )
        return Response(json.dumps(body).encode())
    monkeypatch.setattr(diagnostic, "build_opener", lambda handler: SimpleNamespace(open=open_request))
    database = ReadOnlyDatabase()
    result = run_read(database)
    assert len(calls) == database.reads == 1
    assert result == {
        "provider_installation_read": "SUCCESS",
        "installation_update_at": "2026-09-07T14:06:40Z",
        "push_token_update_at": "2026-09-04T11:06:40Z",
        "push_token_expiration_at": "NONE",
        "subscription_status": "optIn", "subscribed_to_notifications": True, "os_notifications_visible": False,
    }
    assert TARGET not in json.dumps(result) + caplog.text
    assert SECRET not in json.dumps(result) + caplog.text
    assert set(result) == {"provider_installation_read", "installation_update_at", "push_token_update_at", "push_token_expiration_at", "subscription_status", "subscribed_to_notifications", "os_notifications_visible"}


@pytest.mark.parametrize("rows", [[], [{"wonderpush_installation_id": TARGET}] * 2, [{"wonderpush_installation_id": "bad"}]])
def test_missing_ambiguous_or_invalid_registration_does_not_guess(rows, monkeypatch):
    provider = Mock(side_effect=AssertionError("No provider call permitted"))
    monkeypatch.setattr(diagnostic, "provider_get", provider)
    result = run_read(ReadOnlyDatabase(rows))
    assert result["provider_installation_read"] == "FAILED"
    provider.assert_not_called()


@pytest.mark.parametrize("exception,classification,status", [
    (HTTPError("https://secret.invalid/" + TARGET, 401, SECRET, {}, io.BytesIO(SECRET.encode())), "PROVIDER_HTTP_ERROR", 401),
    (HTTPError("https://secret.invalid/" + TARGET, 302, SECRET, {}, io.BytesIO(SECRET.encode())), "PROVIDER_HTTP_ERROR", 302),
    (TimeoutError(SECRET), "PROVIDER_TIMEOUT", None),
    (URLError(SECRET), "PROVIDER_NETWORK_ERROR", None),
    (RuntimeError(SECRET), "PROVIDER_READ_ERROR", None),
])
def test_failure_is_sanitized_and_never_retried(exception, classification, status, monkeypatch, caplog):
    call = Mock(side_effect=exception)
    monkeypatch.setattr(diagnostic, "build_opener", lambda handler: SimpleNamespace(open=call))
    result = run_read(ReadOnlyDatabase())
    assert call.call_count == 1
    assert result["provider_installation_read"] == "FAILED"
    assert result["error_classification"] == classification
    assert result["provider_http_status"] == status
    assert TARGET not in json.dumps(result) + caplog.text
    assert SECRET not in json.dumps(result) + caplog.text


def test_redirects_cannot_leak_credential_or_issue_second_request():
    assert diagnostic.NoRedirect().redirect_request(None, None, 302, SECRET, {}, "https://other.invalid") is None


@pytest.mark.parametrize("body", [[], SECRET, None])
def test_non_object_response_is_not_returned(body):
    result = diagnostic.sanitize(body)
    assert result["provider_installation_read"] == "FAILED"
    assert SECRET not in json.dumps(result)


def test_invalid_values_are_not_echoed_or_coerced():
    result = diagnostic.sanitize({"updateDate": SECRET, "pushToken": {"expirationDate": SECRET},
        "preferences": {"subscriptionStatus": SECRET, "subscribedToNotifications": SECRET, "osNotificationsVisible": 1}})
    assert result["installation_update_at"] == "UNKNOWN"
    assert result["push_token_expiration_at"] == "UNKNOWN"
    assert result["subscribed_to_notifications"] == "UNKNOWN"
    assert result["os_notifications_visible"] == "UNKNOWN"
    assert SECRET not in json.dumps(result)


@pytest.mark.parametrize("staging", [False, True])
def test_actual_route_mount_and_access(staging):
    env = {**os.environ, "CONTENT_SOURCE": "google_sheets", "MONGO_URL": "", "MONGODB_URL": "",
        "PUBLIC_APP_URL": diagnostic.STAGING_APP if staging else "https://theipm.ca",
        "SUPABASE_URL": diagnostic.STAGING_DATABASE,
        "RENDER_EXTERNAL_HOSTNAME": diagnostic.STAGING_HOST if staging else "ipm-backend-eoiw.onrender.com"}
    script = '''
import asyncio, json
import httpx
from backend import server
from backend import staging_provider_diagnostic as diagnostic
from types import SimpleNamespace
calls = []
async def read(*args, **kwargs):
    calls.append('database')
    assert args == ('GET', '/notification_installations')
    return [{'wonderpush_installation_id': 'A' * 40}]
def provider(*args):
    calls.append('provider')
    return diagnostic.sanitize({})
diagnostic.provider_get = provider
server.notification_registration_repository = SimpleNamespace(client=SimpleNamespace(request=read))
server.WONDERPUSH_ACCESS_TOKEN = 'test-only'
async def check():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url='https://ipm-staging-backend.onrender.com') as client:
        path='/api/staging-diagnostics/provider-installation'
        first=await client.get(path)
        second=await client.get(path, headers={'X-IPM-Staging-Diagnostic':'read-current-installation'})
        print(json.dumps({'without_header':first.status_code,'with_header':second.status_code,'calls':calls,'cache':second.headers.get('cache-control')}))
asyncio.run(check())
'''
    result = subprocess.run([sys.executable, "-c", script], env=env, text=True, capture_output=True, check=True)
    data = json.loads(result.stdout.strip())
    assert data["without_header"] == 404
    assert data["with_header"] == (200 if staging else 404)
    assert data["calls"] == (["database", "provider"] if staging else [])
    if staging:
        assert data["cache"] == "no-store"
