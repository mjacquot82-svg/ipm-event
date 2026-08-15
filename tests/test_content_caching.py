import asyncio
from datetime import datetime, timezone
import time
from types import SimpleNamespace

import httpx
import pytest

from backend import server
from backend.platform_services import (
    AsyncTTLCache,
    SupabaseAnnouncementService,
    SupabaseContentClient,
    SupabaseScheduleService,
    SupabaseVendorService,
)


class ContentClient:
    def __init__(self):
        self.event_lookups = 0
        self.calls = []
        self.fail_paths = set()
        self.delay = False

    async def get_event_id(self, value):
        self.event_lookups += 1
        return "event-uuid"

    async def request(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        if self.delay:
            await asyncio.sleep(0.01)
        if path in self.fail_paths:
            raise httpx.ConnectError("provider unavailable")
        if method in {"POST", "PATCH"} and path == "/alerts":
            body = kwargs["json"]
            now = datetime.now(timezone.utc).isoformat()
            return [{"id": "notice-1", "event_id": "event-uuid", "title": body.get("title", "Notice"), "message": body.get("message", "Message"), "severity": body.get("severity", "info"), "status": body["status"], "created_by": body.get("created_by", "Organizer"), "created_at": now, "updated_at": now, "expires_at": body.get("expires_at")}]
        if path == "/schedule_items":
            return [{"id": "schedule-1", "title": "Opening", "starts_at": "2026-09-15T09:00:00-04:00", "ends_at": "2026-09-15T10:00:00-04:00", "category": "Shows", "status": "published", "sort_order": 1}]
        if path == "/vendors":
            return [{"id": "vendor-1", "name": "Farm Stand", "type": "Food", "priority": 1, "status": "published"}]
        if path == "/alerts":
            now = datetime.now(timezone.utc).isoformat()
            return [{"id": "notice-1", "event_id": "event-uuid", "title": "Notice", "message": "Message", "severity": "important", "status": "published", "created_by": "Organizer", "created_at": now, "updated_at": now, "expires_at": None}]
        return []


def schedule_service(client):
    return SupabaseScheduleService(
        supabase_url="https://example.supabase.co", service_role_key="key", event_slug="ipm-2026",
        schedule_response_model=server.ScheduleResponse, schedule_event_model=server.ScheduleEvent,
        admin_schedule_response_model=server.AdminScheduleResponse, admin_schedule_event_model=server.AdminScheduleEvent,
        client=client,
    )


def vendor_service(client):
    return SupabaseVendorService(
        supabase_url="https://example.supabase.co", service_role_key="key", event_slug="ipm-2026",
        vendors_response_model=server.VendorsResponse, vendor_model=server.Vendor, client=client,
    )


def announcement_service(client):
    return SupabaseAnnouncementService(
        supabase_url="https://example.supabase.co", service_role_key="key", event_slug="ipm-2026", client=client,
    )


def expire(cache):
    for key, (_, value) in list(cache._values.items()):
        cache._values[key] = (time.monotonic() - cache.ttl_seconds - 1, value)


def test_event_id_cache_hits_coalesces_and_does_not_cache_failures():
    class Client(SupabaseContentClient):
        def __init__(self):
            super().__init__(supabase_url="https://example.supabase.co", service_role_key="key")
            self.loads = 0
            self.fail = False

        async def _load_event_id(self, slug):
            self.loads += 1
            await asyncio.sleep(0.01)
            if self.fail:
                raise ValueError("missing")
            return "event-uuid"

    async def verify():
        client = Client()
        assert await asyncio.gather(*(client.get_event_id("ipm-2026") for _ in range(30))) == ["event-uuid"] * 30
        assert await client.get_event_id("ipm-2026") == "event-uuid"
        assert client.loads == 1
        client.fail = True
        with pytest.raises(ValueError):
            await client.get_event_id("missing")
        client.fail = False
        assert await client.get_event_id("missing") == "event-uuid"
        assert client.loads == 3
    asyncio.run(verify())


@pytest.mark.parametrize("factory,path", [(schedule_service, "/schedule_items"), (vendor_service, "/vendors")])
def test_public_content_cold_hit_expiry_coalescing_and_stale_if_error(factory, path):
    async def verify():
        client = ContentClient(); client.delay = True
        service = factory(client)
        results = await asyncio.gather(*(service.list_public_schedule() if path == "/schedule_items" else service.list_public_vendors() for _ in range(40)))
        assert len(results) == 40
        assert sum(call[1] == path for call in client.calls) == 1
        content_call = next(call for call in client.calls if call[1] == path)
        assert content_call[2]["params"]["status"] == "neq.archived"
        assert content_call[2]["params"]["order"] == ("starts_at.asc.nullslast,sort_order.asc" if path == "/schedule_items" else "priority.asc,name.asc")
        await (service.list_public_schedule() if path == "/schedule_items" else service.list_public_vendors())
        assert sum(call[1] == path for call in client.calls) == 1
        expire(service._public_cache)
        client.fail_paths.add(path)
        stale = await (service.list_public_schedule() if path == "/schedule_items" else service.list_public_vendors())
        assert stale.total_count == 1
        client.fail_paths.clear(); expire(service._public_cache)
        await (service.list_public_schedule() if path == "/schedule_items" else service.list_public_vendors())
        assert sum(call[1] == path for call in client.calls) == 3
    asyncio.run(verify())


def test_schedule_mutation_invalidates_only_after_success():
    async def verify():
        client = ContentClient(); service = schedule_service(client)
        await service.list_public_schedule()
        assert service._public_cache._values
        payload = SimpleNamespace(title="New", description="", start_date="2026-09-15", start_time="9:00 AM", end_time="10:00 AM", category="Shows", latitude=None, longitude=None, days_active="", location_name=None)
        await service.append_event(payload)
        assert not service._public_cache._values
        await service.list_public_schedule()
        client.fail_paths.add("/schedule_items")
        with pytest.raises(httpx.ConnectError):
            await service.append_event(payload)
        assert service._public_cache._values
    asyncio.run(verify())


def test_vendor_mutation_invalidates_and_repopulates_with_current_public_data():
    async def verify():
        client = ContentClient(); service = vendor_service(client)
        await service.list_public_vendors()
        before = sum(call[1] == "/vendors" for call in client.calls)
        payload = SimpleNamespace(name="New", type="Food", location="", hours_of_operation="", days_of_operation="", priority=1, status="published")
        await service.create_vendor(payload)
        assert sum(call[1] == "/vendors" for call in client.calls) == before + 2
        assert service._public_cache._values
    asyncio.run(verify())


def test_announcement_list_and_detail_share_short_cache_and_mutations_invalidate():
    async def verify():
        client = ContentClient(); client.delay = True
        service = announcement_service(client)
        lists = await asyncio.gather(*(service.list(public=True) for _ in range(30)))
        assert all(items[0]["id"] == "notice-1" for items in lists)
        assert sum(call[1] == "/alerts" for call in client.calls) == 1
        assert (await service.get("notice-1", public=True))["title"] == "Notice"
        assert sum(call[1] == "/alerts" for call in client.calls) == 1
        payload = SimpleNamespace(title="Updated", message="Message", priority="Information", status="published", expires_at=None)
        await service.update("notice-1", payload)
        assert not service._public_cache._values
        await service.list(public=True)
        assert sum(call[1] == "/alerts" for call in client.calls) == 3
        assert service._public_cache.ttl_seconds == 10
        assert service._public_cache.stale_if_error_seconds == 20
    asyncio.run(verify())


def test_failed_refresh_releases_inflight_and_shared_http_client_lifecycle(monkeypatch):
    created = []

    class HttpClient:
        def __init__(self, **kwargs):
            self.kwargs = kwargs; self.closed = False; created.append(self)
        async def aclose(self): self.closed = True

    async def verify():
        attempts = 0
        cache = AsyncTTLCache(ttl_seconds=10, max_entries=2)
        async def loader():
            nonlocal attempts
            attempts += 1
            if attempts == 1: raise RuntimeError("failed")
            return {"safe": True}
        with pytest.raises(RuntimeError): await cache.get_or_load("key", loader)
        assert cache._inflight == {}
        assert await cache.get_or_load("key", loader) == {"safe": True}
        client = SupabaseContentClient(supabase_url="https://example.supabase.co", service_role_key="key")
        await client.start(); first = client._http_client
        await client.start()
        assert client._http_client is first and len(created) == 1
        assert created[0].kwargs["limits"].max_connections == 50
        assert created[0].kwargs["limits"].max_keepalive_connections == 20
        assert created[0].kwargs["timeout"].connect == 5
        await client.close()
        assert created[0].closed and client._http_client is None
        assert "supabase_content_client.close" in __import__("inspect").getsource(server.shutdown_db_client)
    monkeypatch.setattr(httpx, "AsyncClient", HttpClient)
    asyncio.run(verify())


def test_invalidation_during_refresh_forces_a_second_load_before_caching():
    async def verify():
        cache = AsyncTTLCache(ttl_seconds=30, max_entries=2)
        started = asyncio.Event(); release = asyncio.Event(); loads = 0
        async def loader():
            nonlocal loads
            loads += 1
            if loads == 1:
                started.set(); await release.wait()
            return loads
        pending = asyncio.create_task(cache.get_or_load("event", loader))
        await started.wait()
        cache.invalidate("event")
        release.set()
        assert await pending == 2
        assert await cache.get_or_load("event", loader) == 2
        assert loads == 2
    asyncio.run(verify())
