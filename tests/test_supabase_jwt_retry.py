"""Exercise actual content reads with injected PostgREST clock-skew responses."""
import asyncio
from unittest.mock import AsyncMock

import httpx
import pytest

from backend.platform_services import SupabaseContentClient

JWT = {"code": "PGRST303", "message": "JWT issued at future", "details": None, "hint": None}


def client_with_responses(monkeypatch, responses):
    calls = []
    original = httpx.AsyncClient

    def handler(request):
        calls.append(request)
        status, body = responses[min(len(calls) - 1, len(responses) - 1)]
        return httpx.Response(status, json=body)

    monkeypatch.setattr(httpx, "AsyncClient", lambda: original(transport=httpx.MockTransport(handler)))
    sleep = AsyncMock()
    monkeypatch.setattr("backend.platform_services.asyncio.sleep", sleep)
    return SupabaseContentClient(supabase_url="https://example.invalid", service_role_key="test"), calls, sleep


@pytest.mark.parametrize("path", ["/schedule_events", "/announcements", "/content_revisions"])
def test_future_jwt_read_recovers_with_bounded_backoff(monkeypatch, path):
    client, calls, sleep = client_with_responses(monkeypatch, [(401, JWT), (401, JWT), (200, [{"revision": 8}])])
    assert asyncio.run(client.request("GET", path, headers={"X-Test": "preserved"}, params={"select": "revision"})) == [{"revision": 8}]
    assert len(calls) == 3
    assert [call.args[0] for call in sleep.call_args_list] == [0.25, 0.5]
    assert all(request.headers["X-Test"] == "preserved" and request.url.params["select"] == "revision" for request in calls)


def test_revision_exhaustion_preserves_http_failure(monkeypatch):
    client, calls, sleep = client_with_responses(monkeypatch, [(401, JWT)])
    with pytest.raises(httpx.HTTPStatusError, match="JWT issued at future") as error:
        asyncio.run(client.get_content_revision("event", "schedule"))
    assert error.value.response.status_code == 401
    assert error.value.response.json() == JWT
    assert len(calls) == 3
    assert sleep.await_count == 2


@pytest.mark.parametrize("method", ["POST", "PATCH", "PUT", "DELETE"])
def test_unsafe_writes_are_never_retried(monkeypatch, method):
    client, calls, sleep = client_with_responses(monkeypatch, [(401, JWT)])
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(client.request(method, "/schedule_events", json={"title": "test"}))
    assert len(calls) == 1
    sleep.assert_not_called()


@pytest.mark.parametrize("status,body", [(401, {"code": "PGRST303", "message": "JWT expired"}), (401, {"code": "PGRST301", "message": "invalid JWT"}), (401, {}), (403, JWT), (500, JWT)])
def test_unrelated_errors_are_not_retried(monkeypatch, status, body):
    client, calls, sleep = client_with_responses(monkeypatch, [(status, body)])
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(client.request("GET", "/events"))
    assert len(calls) == 1
    sleep.assert_not_called()


@pytest.mark.parametrize("content_type", ["schedule", "announcements"])
@pytest.mark.parametrize("failure", ["jwt", "changed"])
def test_content_is_not_returned_with_failed_or_changed_revision(monkeypatch, content_type, failure):
    from backend.platform_services import SupabaseScheduleService, SupabaseAnnouncementService
    cls = SupabaseScheduleService if content_type == "schedule" else SupabaseAnnouncementService
    service = object.__new__(cls)
    service._get_event_id = AsyncMock(return_value="event")
    service._list_rows = AsyncMock(return_value=[])
    service.list = AsyncMock(return_value=[])
    service.schedule_response_model = lambda **kwargs: kwargs
    # First revision succeeds, data read succeeds, then final revision fails or
    # has advanced during retries. Neither may produce a versioned response.
    client, calls, sleep = client_with_responses(monkeypatch, [
        (200, [{"revision": 7}]),
        (401, JWT) if failure == "jwt" else (200, [{"revision": 8}]),
    ])
    service.client = client
    request = service.list_public_schedule() if content_type == "schedule" else service._list_with_revision(public=True)
    with pytest.raises(httpx.HTTPStatusError if failure == "jwt" else ValueError):
        asyncio.run(request)
    assert len(calls) == (4 if failure == "jwt" else 2)
