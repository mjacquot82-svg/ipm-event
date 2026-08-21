import asyncio
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

    def notification_content(self, title, message, target_url):
        return WonderPushClient(access_token="token").notification_content(
            title, message, target_url
        )

    async def send_test(self, *, title, message, target_url, installation_ids):
        self.test_installations = list(installation_ids)
        if self.fail:
            raise WonderPushError("provider failed")
        return "test-campaign"

    async def send_everyone(self, **kwargs):
        if self.fail:
            raise WonderPushError("provider failed")
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
    monkeypatch.setattr(server, "PUBLIC_APP_URL", "https://staging.theipm.ca")
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
    assert result.audience == "test"
    assert deliveries.rows[0]["provider_campaign_id"] == "test-campaign"
    assert deliveries.rows[0]["provider"] == "wonderpush"
    assert deliveries.rows[0]["target_url"] == "https://staging.theipm.ca/announcements/announcement-1"


def test_everyone_send_cannot_duplicate_after_success(monkeypatch):
    _, deliveries = configure_notification_fakes(monkeypatch, announcement())
    user = {"username": "owner", "role": "Owner", "event_id": "event-a"}
    first = asyncio.run(server.notify_announcement("announcement-1", "everyone", user))
    assert first.provider_campaign_id == "everyone-campaign"
    with pytest.raises(HTTPException) as duplicate:
        asyncio.run(server.notify_announcement("announcement-1", "everyone", user))
    assert duplicate.value.status_code == 409


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
        target_url="https://staging.theipm.ca/announcements/announcement-1",
        installation_ids=["123", "456"],
    ))

    assert result == "/v1/deliveries/delivery-123"
    assert captured["url"] == "https://management-api.wonderpush.com/v1/deliveries"
    assert captured["data"]["accessToken"] == "not-a-credential"
    assert captured["data"]["targetInstallationIds"] == "123,456"
    assert captured["data"]["filterPlatforms"] == "Web"
    notification = __import__("json").loads(captured["data"]["notification"])
    assert notification["alert"] == {
        "title": "Title", "text": "Message",
        "targetUrl": "https://staging.theipm.ca/announcements/announcement-1",
    }
    assert notification["push"]["custom"]["target_url"].endswith("/announcements/announcement-1")


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
        title="Title", message="Message", target_url="https://staging.theipm.ca",
    ))
    assert result == "wonderpush:accepted"
    assert captured["data"]["targetSegmentIds"] == "@ALL"
    assert "targetInstallationIds" not in captured["data"]


def test_wonderpush_errors_are_normalized_without_exposing_provider_body(monkeypatch):
    class FakeHttpClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return None
        async def post(self, *args, **kwargs):
            return httpx.Response(401, text="secret provider diagnostic")

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: FakeHttpClient())
    client = WonderPushClient(access_token="not-a-credential")
    with pytest.raises(WonderPushError, match=r"WonderPush rejected.*HTTP 401") as error:
        asyncio.run(client.send_everyone(
            title="Title", message="Message", target_url="https://staging.theipm.ca",
        ))
    assert "secret provider diagnostic" not in str(error.value)
