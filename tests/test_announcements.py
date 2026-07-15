import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from backend.platform_services import SupabaseAnnouncementService


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
