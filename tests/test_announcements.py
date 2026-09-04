import asyncio
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException

from backend import server
from backend.platform_services import SupabaseAnnouncementService, WonderPushClient, WonderPushError


class FakeClient:
    def __init__(self, rows_by_event):
        self.rows_by_event = rows_by_event
        self.calls = []

    async def get_event_id(self, event_slug):
        return event_slug

    async def request(self, method, path, params=None, **kwargs):
        self.calls.append((method, path, params))
        assert method == "GET"
        assert path == "/alerts"
        event_id = params["event_id"].removeprefix("eq.")
        rows = list(self.rows_by_event.get(event_id, []))
        if "id" in params:
            announcement_id = params["id"].removeprefix("eq.")
            rows = [row for row in rows if row["id"] == announcement_id]
        if params.get("status") == "eq.published":
            rows = [row for row in rows if row["status"] == "published"]
        return rows


def make_row(event_id, title, severity, status="published", created_offset=0, expires_offset=None):
    now = datetime.now(timezone.utc)
    return {
        "id": f"{event_id}-{title}",
        "event_id": event_id,
        "title": title,
        "message": f"Message for {title}",
        "severity": severity,
        "status": status,
        "created_by": "Organizer",
        "created_at": (now + timedelta(minutes=created_offset)).isoformat(),
        "updated_at": now.isoformat(),
        "expires_at": (now + timedelta(minutes=expires_offset)).isoformat() if expires_offset is not None else None,
    }


def test_public_announcements_are_event_isolated_filtered_and_ordered():
    service = SupabaseAnnouncementService(
        supabase_url="https://example.supabase.co",
        service_role_key="test",
        event_slug="event-a",
    )
    service.client = FakeClient({
        "event-a": [
            make_row("event-a", "Old information", "info", created_offset=-10),
            make_row("event-a", "New information", "info", created_offset=-1),
            make_row("event-a", "Important", "important"),
            make_row("event-a", "Emergency", "emergency"),
            make_row("event-a", "Draft", "emergency", status="draft"),
            make_row("event-a", "Expired", "emergency", expires_offset=-1),
        ],
        "event-b": [make_row("event-b", "Other event", "emergency")],
    })

    result = asyncio.run(service.list("event-a", public=True))

    assert service.client.calls == [("GET", "/alerts", {
        "select": "*", "event_id": "eq.event-a", "status": "eq.published"
    })]
    assert [item["title"] for item in result] == [
        "Emergency", "Important", "New information", "Old information"
    ]
    assert all(item["event_id"] == "event-a" for item in result)


def test_admin_list_includes_all_statuses_for_only_its_event():
    service = SupabaseAnnouncementService(
        supabase_url="https://example.supabase.co",
        service_role_key="test",
        event_slug="event-a",
    )
    service.client = FakeClient({
        "event-a": [
            make_row("event-a", "Active", "info"),
            make_row("event-a", "Archived", "important", status="archived"),
        ],
        "event-b": [make_row("event-b", "Other event", "emergency")],
    })

    result = asyncio.run(service.list("event-a"))

    assert {item["title"] for item in result} == {"Active", "Archived"}
    assert all(item["event_id"] == "event-a" for item in result)


class CrudClient:
    def __init__(self):
        self.calls = []

    async def get_event_id(self, event_slug):
        return event_slug

    async def request(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        if method == "DELETE":
            return [{"id": "announcement-1"}]
        body = kwargs["json"]
        now = datetime.now(timezone.utc).isoformat()
        return [{
            "id": "announcement-1", "event_id": body.get("event_id", "event-a"),
            "title": body.get("title", "Title"), "message": body.get("message", "Message"),
            "severity": body.get("severity", "info"), "status": body["status"],
            "created_by": body.get("created_by", "Organizer"), "created_at": now,
            "updated_at": now, "expires_at": body.get("expires_at"),
        }]


def test_crud_writes_are_scoped_to_the_event():
    service = SupabaseAnnouncementService(
        supabase_url="https://example.supabase.co", service_role_key="test", event_slug="event-a"
    )
    client = CrudClient()
    service.client = client
    payload = SimpleNamespace(
        title=" Title ", message=" Message ", priority="Important", expires_at=None, status="draft"
    )

    created = asyncio.run(service.create(payload, "Organizer", "event-a"))
    updated = asyncio.run(service.update("announcement-1", payload, "event-a"))
    published = asyncio.run(service.set_status("announcement-1", "published", "event-a"))
    archived = asyncio.run(service.set_status("announcement-1", "archived", "event-a"))
    deleted = asyncio.run(service.delete("announcement-1", "event-a"))

    assert created["priority"] == "Important"
    assert created["status"] == updated["status"] == "draft"
    assert published["status"] == "published"
    assert archived["status"] == "archived"
    assert updated["id"] == published["id"] == archived["id"] == "announcement-1"
    assert deleted is True
    assert client.calls[0][2]["json"]["published_at"] is None
    assert client.calls[2][2]["json"]["published_at"] is not None
    for method, _, kwargs in client.calls[1:]:
        assert kwargs["params"]["event_id"] == "eq.event-a"


def test_single_announcement_public_visibility_rules():
    service = SupabaseAnnouncementService(
        supabase_url="https://example.supabase.co", service_role_key="test", event_slug="event-a"
    )
    published = make_row("event-a", "Published", "info")
    draft = make_row("event-a", "Draft", "info", status="draft")
    archived = make_row("event-a", "Archived", "info", status="archived")
    expired = make_row("event-a", "Expired", "info", expires_offset=-1)
    other_event = make_row("event-b", "Other", "info")
    service.client = FakeClient({
        "event-a": [published, draft, archived, expired],
        "event-b": [other_event],
    })

    assert asyncio.run(service.get(published["id"], "event-a", public=True))["title"] == "Published"
    assert asyncio.run(service.get(draft["id"], "event-a", public=True)) is None
    assert asyncio.run(service.get(archived["id"], "event-a", public=True)) is None
    assert asyncio.run(service.get(expired["id"], "event-a", public=True)) is None
    assert asyncio.run(service.get(other_event["id"], "event-a", public=True)) is None
    assert asyncio.run(service.get("missing", "event-a", public=True)) is None


def test_single_announcement_endpoint_returns_404_for_non_public_items(monkeypatch):
    visible = announcement()
    monkeypatch.setattr(
        server,
        "announcement_service",
        FakeAnnouncementService({("event-a", "announcement-1"): visible}),
    )
    result = asyncio.run(server.get_public_announcement("announcement-1", "event-a"))
    assert result["id"] == "announcement-1"

    monkeypatch.setattr(server, "announcement_service", FakeAnnouncementService({}))
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.get_public_announcement("announcement-1", "event-a"))
    assert error.value.status_code == 404


class FakeAnnouncementService:
    def __init__(self, announcements):
        self.announcements = announcements

    async def get(self, announcement_id, event_id, public=False):
        announcement = self.announcements.get((event_id, announcement_id))
        if not announcement or not public:
            return announcement
        if announcement["status"] != "published":
            return None
        if announcement.get("expires_at") and datetime.fromisoformat(announcement["expires_at"]) <= datetime.now(timezone.utc):
            return None
        return announcement


class FakeDeliveryService:
    def __init__(self):
        self.rows = []
        self.active_everyone = set()

    async def create_requested(self, **values):
        key = (values["event_id"], values["announcement_id"])
        if values["audience"] == "everyone" and key in self.active_everyone:
            request = httpx.Request("POST", "https://example.test/notification_deliveries")
            response = httpx.Response(409, request=request)
            raise httpx.HTTPStatusError("duplicate", request=request, response=response)
        if values["audience"] == "everyone":
            self.active_everyone.add(key)
        row = {
            "id": f"delivery-{len(self.rows) + 1}",
            **values,
            "provider": values.get("provider", "wonderpush"),
            "provider_campaign_id": None,
            "status": "requested",
            "requested_at": datetime.now(timezone.utc),
            "sent_at": None,
            "error_message": None,
        }
        self.rows.append(row)
        return row

    async def mark_sent(self, delivery_id, campaign_id):
        row = next(row for row in self.rows if row["id"] == delivery_id)
        row.update(status="sent", provider_campaign_id=campaign_id, sent_at=datetime.now(timezone.utc))
        return row

    async def mark_failed(self, delivery_id, error_message):
        row = next(row for row in self.rows if row["id"] == delivery_id)
        row.update(status="failed", error_message=error_message)
        if row["audience"] == "everyone":
            self.active_everyone.discard((row["event_id"], row["announcement_id"]))
        return row


class FakeWonderPush:
    def __init__(self, fail=False):
        self.fail = fail
        self.test_installations = None
        self.test_options = None
        self.everyone_options = None

    def notification_content(self, title, message, target_url):
        return WonderPushClient(access_token="token").notification_content(
            title, message, target_url
        )

    async def send_test(self, *, title, message, target_url, installation_ids, **kwargs):
        self.test_installations = list(installation_ids)
        self.test_options = kwargs
        if self.fail:
            raise server.WonderPushError("provider failed")
        return "test-campaign"

    async def send_everyone(self, **kwargs):
        self.everyone_options = kwargs
        if self.fail:
            raise server.WonderPushError("provider failed")
        return "everyone-campaign"


def announcement(status="published", *, expires_at=None):
    now = datetime.now(timezone.utc)
    return {
        "id": "announcement-1", "event_id": "event-a", "title": "Title",
        "message": "Message", "priority": "Information", "status": status,
        "expires_at": expires_at, "created_by": "Organizer",
        "created_at": now, "updated_at": now,
    }


def configure_notification_fakes(monkeypatch, item, *, provider=None, deliveries=None):
    provider = provider or FakeWonderPush()
    deliveries = deliveries or FakeDeliveryService()
    monkeypatch.setattr(server, "announcement_service", FakeAnnouncementService({("event-a", "announcement-1"): item}))
    monkeypatch.setattr(server, "notification_delivery_service", deliveries)
    monkeypatch.setattr(server, "wonderpush_client", provider)
    monkeypatch.setattr(server, "WONDERPUSH_TEST_INSTALLATION_IDS", ["test-1", "test-2"])
    monkeypatch.setattr(server, "WONDERPUSH_TEST_CAMPAIGN_ID", "controlled-test-campaign")
    monkeypatch.setattr(server, "PUBLIC_APP_URL", "https://theipm.ca")
    return provider, deliveries


@pytest.mark.parametrize("status", ["draft", "archived"])
def test_non_published_announcement_cannot_notify(monkeypatch, status):
    configure_notification_fakes(monkeypatch, announcement(status))
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.notify_announcement("announcement-1", "everyone", {
            "username": "owner", "role": "Owner", "event_id": "event-a"
        }))
    assert error.value.status_code == 409


def test_expired_announcement_cannot_notify(monkeypatch):
    expired = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    configure_notification_fakes(monkeypatch, announcement(expires_at=expired))
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.notify_announcement("announcement-1", "everyone", {
            "username": "owner", "role": "Owner", "event_id": "event-a"
        }))
    assert error.value.status_code == 409


def test_cross_event_and_unauthorized_notification_attempts_are_rejected(monkeypatch):
    configure_notification_fakes(monkeypatch, announcement())
    with pytest.raises(HTTPException) as cross_event:
        asyncio.run(server.notify_announcement("announcement-1", "everyone", {
            "username": "owner", "role": "Owner", "event_id": "event-b"
        }))
    assert cross_event.value.status_code == 409
    with pytest.raises(HTTPException) as unauthorized:
        asyncio.run(server.notify_announcement("announcement-1", "everyone", {
            "username": "scheduler", "role": "Schedule", "event_id": "event-a"
        }))
    assert unauthorized.value.status_code == 403


def test_test_send_uses_only_configured_subscribers(monkeypatch):
    provider, deliveries = configure_notification_fakes(monkeypatch, announcement())
    result = asyncio.run(server.notify_announcement("announcement-1", "test", {
        "username": "comms", "role": "Communications", "event_id": "event-a"
    }))
    assert provider.test_installations == ["test-1", "test-2"]
    assert provider.test_options["campaign_id"] == "controlled-test-campaign"
    assert provider.test_options["idempotency_key"].startswith("announcement-test-")
    assert 0 < int(provider.test_options["expiration_time"].split()[0]) <= 72 * 60 * 60
    assert result.audience == "test"
    assert deliveries.rows[0]["provider_campaign_id"] == "test-campaign"
    assert deliveries.rows[0]["provider"] == "wonderpush"
    assert deliveries.rows[0]["target_url"] == "https://theipm.ca/announcements/announcement-1"


def test_test_send_requires_configured_wonderpush_campaign(monkeypatch):
    provider, deliveries = configure_notification_fakes(monkeypatch, announcement())
    monkeypatch.setattr(server, "WONDERPUSH_TEST_CAMPAIGN_ID", "")

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.notify_announcement("announcement-1", "test", {
            "username": "comms", "role": "Communications", "event_id": "event-a"
        }))

    assert error.value.status_code == 503
    assert "controlled test WonderPush campaign" in error.value.detail
    assert provider.test_installations is None
    assert deliveries.rows == []


def test_everyone_send_cannot_duplicate_after_success(monkeypatch):
    provider, deliveries = configure_notification_fakes(monkeypatch, announcement())
    user = {"username": "owner", "role": "Owner", "event_id": "event-a"}
    first = asyncio.run(server.notify_announcement("announcement-1", "everyone", user))
    assert first.provider_campaign_id == "everyone-campaign"
    assert "campaign_id" not in provider.everyone_options
    assert provider.everyone_options["idempotency_key"] == "announcement-event-a-announcement-1"
    assert provider.everyone_options["expiration_time"] == "259200 seconds"
    with pytest.raises(HTTPException) as duplicate:
        asyncio.run(server.notify_announcement("announcement-1", "everyone", user))
    assert duplicate.value.status_code == 409


def test_announcement_send_is_independent_of_reminder_kill_switch(monkeypatch):
    provider, _ = configure_notification_fakes(monkeypatch, announcement())
    monkeypatch.setattr(server, "ITINERARY_REMINDER_DELIVERY_ENABLED", False)
    result = asyncio.run(server.notify_announcement("announcement-1", "everyone", {
        "username": "comms", "role": "Communications", "event_id": "event-a"
    }))
    assert result.status == "sent"
    assert "campaign_id" not in provider.everyone_options


def test_earlier_announcement_expiry_shortens_push_ttl(monkeypatch):
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    provider, _ = configure_notification_fakes(monkeypatch, announcement(expires_at=expires_at))
    asyncio.run(server.notify_announcement("announcement-1", "everyone", {
        "username": "comms", "role": "Communications", "event_id": "event-a"
    }))
    ttl = int(provider.everyone_options["expiration_time"].split()[0])
    assert 60 <= ttl <= 2 * 60 * 60


def test_effectively_stale_announcement_creates_no_delivery(monkeypatch):
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=30)).isoformat()
    provider, deliveries = configure_notification_fakes(monkeypatch, announcement(expires_at=expires_at))
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.notify_announcement("announcement-1", "everyone", {
            "username": "comms", "role": "Communications", "event_id": "event-a"
        }))
    assert error.value.status_code == 409
    assert deliveries.rows == []
    assert provider.everyone_options is None


def test_provider_failure_is_persisted(monkeypatch):
    _, deliveries = configure_notification_fakes(monkeypatch, announcement(), provider=FakeWonderPush(fail=True))
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.notify_announcement("announcement-1", "everyone", {
            "username": "owner", "role": "Owner", "event_id": "event-a"
        }))
    assert error.value.status_code == 502
    assert deliveries.rows[0]["status"] == "failed"
    assert deliveries.rows[0]["error_message"] == "provider failed"


def test_wonderpush_payload_targets_installations_and_preserves_deep_link(monkeypatch):
    captured = {}

    class FakeHttpClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            captured.update(url=url, **kwargs)
            return httpx.Response(202, headers={"Location": "/v1/deliveries/delivery-123"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: FakeHttpClient())
    client = WonderPushClient(access_token="not-a-credential")

    result = asyncio.run(client.send_test(
        title="Title",
        message="Message",
        target_url="https://theipm.ca/announcements/announcement-1",
        installation_ids=["123", "456"],
        idempotency_key="announcement-test-delivery-123",
        campaign_id="controlled-test-campaign",
        expiration_time="72 hours",
    ))

    assert result == "/v1/deliveries/delivery-123"
    assert captured["url"] == "https://management-api.wonderpush.com/v1/deliveries"
    assert captured["data"]["accessToken"] == "not-a-credential"
    assert captured["data"]["targetInstallationIds"] == "123,456"
    assert captured["data"]["filterPlatforms"] == "Web"
    assert captured["data"]["campaignId"] == "controlled-test-campaign"
    assert "disableCapping" not in captured["data"]
    assert captured["headers"] == {
        "X-WonderPush-Idempotency-Key": "announcement-test-delivery-123"
    }
    notification = __import__("json").loads(captured["data"]["notification"])
    assert notification["alert"] == {
        "title": "IPM — Title", "text": "Message",
        "targetUrl": "https://theipm.ca/announcements/announcement-1",
        "web": {"icon": "https://theipm.ca/ipm-icon-any-192.png"},
    }
    assert notification["push"]["custom"]["target_url"].endswith("/announcements/announcement-1")
    assert notification["push"]["custom"]["diagnostic_id"] == "announcement-test-delivery-123"
    assert notification["push"]["expirationTime"] == "72 hours"


def test_wonderpush_everyone_targets_all_web_installations(monkeypatch):
    captured = {}

    class FakeHttpClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            captured.update(url=url, **kwargs)
            return httpx.Response(202, text="")

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: FakeHttpClient())
    client = WonderPushClient(access_token="not-a-credential")
    result = asyncio.run(client.send_everyone(
        title="Title", message="Message", target_url="https://theipm.ca",
        expiration_time="72 hours", idempotency_key="announcement-event-a-announcement-1",
    ))
    assert result == "wonderpush:accepted"
    assert captured["data"]["targetSegmentIds"] == "@ALL"
    assert "campaignId" not in captured["data"]
    assert "targetInstallationIds" not in captured["data"]
    assert "disableCapping" not in captured["data"]
    assert captured["headers"] == {
        "X-WonderPush-Idempotency-Key": "announcement-event-a-announcement-1"
    }
    assert __import__("json").loads(captured["data"]["notification"])["push"][
        "expirationTime"] == "72 hours"


@pytest.mark.parametrize(("status", "content", "content_type", "expected"), [
    (404, '{"error":{"code":"campaign_not_found","message":"Campaign does not exist"}}',
        "application/json", "Campaign does not exist"),
    (400, '{"code":"invalid_request","message":"Invalid delivery request"}',
        "application/json", "Invalid delivery request"),
    (503, "Provider temporarily unavailable", "text/plain", "Provider temporarily unavailable"),
    (502, "", "text/plain", "WonderPush returned no response body"),
    (404, "<html><body><h1>Proxy not found</h1></body></html>", "text/html",
        "WonderPush returned an HTML error response"),
])
def test_wonderpush_errors_retain_bounded_safe_diagnostics(
    monkeypatch, status, content, content_type, expected,
):
    class FakeHttpClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return None
        async def post(self, *args, **kwargs):
            return httpx.Response(status, text=content, headers={
                "Content-Type": content_type, "X-Request-Id": "provider-request-123",
            })

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: FakeHttpClient())
    client = WonderPushClient(access_token="not-a-credential")
    with pytest.raises(WonderPushError, match=rf"WonderPush rejected.*HTTP {status}") as error:
        asyncio.run(client.send_test(
            title="Title", message="Message", target_url="https://theipm.ca",
            installation_ids=["installation-safe-test"], campaign_id="campaign-safe-test",
        ))
    assert expected in str(error.value)
    assert error.value.provider_request_id == "provider-request-123"
    assert error.value.response_summary and len(error.value.response_summary) <= 500


def test_wonderpush_error_redacts_targets_credentials_and_logs_only_safe_context(monkeypatch, caplog):
    installation_id = "fake-installation-id-that-must-never-appear"
    access_token = "fake-access-token-that-must-never-appear"
    campaign_id = "fake-campaign-id-that-must-never-appear"
    response_text = json.dumps({"error": {"code": "not_found", "message":
        f"targetInstallationIds={installation_id} accessToken={access_token} "
        f"api_key=another-fake-secret campaign={campaign_id}"}})

    class FakeHttpClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return None
        async def post(self, *args, **kwargs):
            return httpx.Response(404, text=response_text, headers={"Content-Type": "application/json"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: FakeHttpClient())
    client = WonderPushClient(access_token=access_token)
    with caplog.at_level("WARNING"), pytest.raises(WonderPushError) as caught:
        asyncio.run(client.send_test(title="Title", message="Message",
            target_url="https://theipm.ca", installation_ids=[installation_id],
            campaign_id=campaign_id))
    combined = f"{caught.value} {caught.value.response_summary} {caplog.text}"
    assert installation_id not in combined
    assert access_token not in combined
    assert campaign_id not in combined
    assert "another-fake-secret" not in combined
    assert "audience=test" in caplog.text
    assert "target_count=1" in caplog.text


def test_broadcast_provider_diagnostic_is_persisted_but_organizer_error_is_generic(monkeypatch):
    provider, deliveries = configure_notification_fakes(
        monkeypatch, announcement(), provider=FakeWonderPush(fail=True))
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.notify_announcement("announcement-1", "everyone", {
            "username": "owner", "role": "Owner", "event_id": "event-a",
        }))
    assert error.value.detail == "Notification could not be sent."
    assert deliveries.rows[0]["error_message"] == "provider failed"
