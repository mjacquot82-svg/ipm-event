"""Platform service abstractions.

These services define backend-owned content boundaries for the reusable event
platform. Phase 1 keeps the existing data providers in place and routes calls
through these services so future Supabase-backed implementations can replace
the providers without changing frontend API contracts.
"""

from __future__ import annotations

import asyncio
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from copy import deepcopy
from datetime import datetime, timezone
import logging
import time
from typing import Any, Optional
from zoneinfo import ZoneInfo

import httpx


logger = logging.getLogger(__name__)


class AsyncTTLCache:
    """Small process-local TTL cache with per-key request coalescing."""

    def __init__(self, *, ttl_seconds: float, max_entries: int, stale_if_error_seconds: float = 0):
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self.stale_if_error_seconds = stale_if_error_seconds
        self._values: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._inflight: dict[str, asyncio.Task[Any]] = {}
        self._inflight_generations: dict[str, int] = {}
        self._generation = 0

    def invalidate(self, key: Optional[str] = None) -> None:
        self._generation += 1
        if key is None:
            self._values.clear()
        else:
            self._values.pop(key, None)

    async def get_or_load(self, key: str, loader: Callable[[], Awaitable[Any]]) -> Any:
        now = time.monotonic()
        cached = self._values.get(key)
        if cached and now - cached[0] < self.ttl_seconds:
            self._values.move_to_end(key)
            return deepcopy(cached[1])

        task = self._inflight.get(key)
        if task is None:
            task = asyncio.create_task(loader())
            self._inflight[key] = task
            self._inflight_generations[key] = self._generation
            task.add_done_callback(lambda completed, cache_key=key: self._finish_load(cache_key, completed))
        load_generation = self._inflight_generations[key]
        try:
            value = await asyncio.shield(task)
        except Exception:
            if self._inflight.get(key) is task and task.done():
                self._inflight.pop(key, None)
                self._inflight_generations.pop(key, None)
            cached = self._values.get(key)
            if cached and time.monotonic() - cached[0] < self.ttl_seconds + self.stale_if_error_seconds:
                return deepcopy(cached[1])
            raise
        if self._inflight.get(key) is task:
            self._inflight.pop(key, None)
            self._inflight_generations.pop(key, None)
        if load_generation != self._generation:
            return await self.get_or_load(key, loader)
        self._values[key] = (time.monotonic(), deepcopy(value))
        self._values.move_to_end(key)
        while len(self._values) > self.max_entries:
            self._values.popitem(last=False)
        return deepcopy(value)

    def _finish_load(self, key: str, task: asyncio.Task[Any]) -> None:
        if self._inflight.get(key) is task:
            self._inflight.pop(key, None)
            self._inflight_generations.pop(key, None)
        if not task.cancelled():
            task.exception()


class WebpushrError(Exception):
    """Normalized provider error safe to expose through the admin API."""


class WebpushrClient:
    """Small server-side client for the Webpushr campaign API."""

    BASE_URL = "https://api.webpushr.com/v1"
    TITLE_LIMIT = 100
    MESSAGE_LIMIT = 255
    TARGET_URL_LIMIT = 255

    def __init__(self, *, api_key: str, auth_token: str, timeout: float = 10.0):
        self.api_key = api_key
        self.auth_token = auth_token
        self.timeout = timeout

    @staticmethod
    def shorten(value: str, limit: int) -> str:
        normalized = " ".join(value.split())
        if len(normalized) <= limit:
            return normalized
        return normalized[: limit - 1].rstrip() + "…"

    def notification_content(self, title: str, message: str, target_url: str) -> dict[str, str]:
        return {
            "title": self.shorten(title, self.TITLE_LIMIT),
            "message": self.shorten(message, self.MESSAGE_LIMIT),
            "target_url": self.shorten(target_url, self.TARGET_URL_LIMIT),
        }

    async def _send(
        self,
        endpoint: str,
        payload: dict[str, Any],
        *,
        success_reference: Optional[str] = None,
    ) -> str:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.BASE_URL}{endpoint}",
                    headers={
                        "webpushrKey": self.api_key,
                        "webpushrAuthToken": self.auth_token,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            raise WebpushrError("Webpushr request timed out") from exc
        except httpx.RequestError as exc:
            raise WebpushrError("Webpushr could not be reached") from exc

        logger.info(
            "Webpushr response endpoint=%s status_code=%s body=%s",
            endpoint,
            response.status_code,
            response.text,
        )
        try:
            result = response.json()
        except ValueError as exc:
            raise WebpushrError(f"Webpushr returned an invalid response ({response.status_code})") from exc
        if not isinstance(result, dict):
            raise WebpushrError(f"Webpushr returned an invalid response ({response.status_code})")
        if response.status_code >= 400 or result.get("status") != "success":
            description = result.get("description") or f"HTTP {response.status_code}"
            raise WebpushrError(f"Webpushr rejected the notification: {description}")
        campaign_id = result.get("ID")
        if campaign_id is None:
            if success_reference is not None:
                return success_reference
            raise WebpushrError("Webpushr response did not include a campaign ID")
        return str(campaign_id)

    async def send_everyone(self, *, title: str, message: str, target_url: str) -> str:
        content = self.notification_content(title, message, target_url)
        return await self._send("/notification/send/all", content)

    async def send_test(
        self, *, title: str, message: str, target_url: str, subscriber_ids: list[str]
    ) -> str:
        if not subscriber_ids:
            raise WebpushrError("No Webpushr test subscriber IDs are configured")
        content = self.notification_content(title, message, target_url)
        campaign_ids = []
        for subscriber_id in subscriber_ids:
            campaign_ids.append(await self._send(
                "/notification/send/sid",
                {**content, "sid": subscriber_id},
                success_reference=f"sid:{subscriber_id}",
            ))
        return ",".join(campaign_ids)


class EventService:
    """Resolve platform event context for backend content services."""

    def __init__(self, default_event_id: str):
        self.default_event_id = default_event_id.strip()

    def get_event_id(self, event_id: Optional[str] = None) -> str:
        return (event_id or self.default_event_id).strip()

    def get_public_event_id(self) -> str:
        return self.get_event_id()

    def get_request_event_id(self, request: Any = None) -> str:
        return self.get_public_event_id()

    def get_admin_event_id(
        self,
        user: Optional[dict[str, Any]] = None,
        event_id: Optional[str] = None,
    ) -> str:
        if event_id:
            return self.get_event_id(event_id)
        if user:
            return self.get_event_id(user.get("event_id"))
        return self.get_event_id()


class ScheduleService:
    """Schedule content boundary.

    The current implementation delegates to the existing Google Sheets-backed
    functions. Supabase can replace these providers later without changing the
    public schedule API shape.
    """

    def __init__(
        self,
        list_public_schedule: Callable[[], Awaitable[Any]],
        list_admin_schedule: Callable[[], Awaitable[Any]],
        replace_schedule: Callable[[Any], Awaitable[Any]],
        append_schedule_event: Callable[[Any], Awaitable[Any]],
        update_schedule_event: Callable[[str, Any], Awaitable[Any]],
        clear_schedule_event: Callable[[str], Awaitable[Any]],
    ):
        self._list_public_schedule = list_public_schedule
        self._list_admin_schedule = list_admin_schedule
        self._replace_schedule = replace_schedule
        self._append_schedule_event = append_schedule_event
        self._update_schedule_event = update_schedule_event
        self._clear_schedule_event = clear_schedule_event

    async def list_public_schedule(self, event_id: Optional[str] = None) -> Any:
        return await self._list_public_schedule()

    async def list_admin_schedule(self, event_id: Optional[str] = None) -> Any:
        return await self._list_admin_schedule()

    async def replace_schedule(self, rows: Any, event_id: Optional[str] = None) -> Any:
        return await self._replace_schedule(rows)

    async def append_event(self, payload: Any, event_id: Optional[str] = None) -> Any:
        return await self._append_schedule_event(payload)

    async def update_event(
        self,
        schedule_event_id: str,
        payload: Any,
        event_id: Optional[str] = None,
    ) -> Any:
        return await self._update_schedule_event(schedule_event_id, payload)

    async def clear_event(
        self,
        schedule_event_id: str,
        event_id: Optional[str] = None,
    ) -> Any:
        return await self._clear_schedule_event(schedule_event_id)


class SupabaseContentClient:
    """Shared Supabase REST client for backend-owned content services."""

    def __init__(self, *, supabase_url: str, service_role_key: str):
        self.supabase_url = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.timeout = httpx.Timeout(30.0, connect=5.0, pool=5.0)
        self.limits = httpx.Limits(max_connections=50, max_keepalive_connections=20, keepalive_expiry=30.0)
        self._http_client: Optional[httpx.AsyncClient] = None
        self._event_ids = AsyncTTLCache(ttl_seconds=3600, max_entries=16)

    async def start(self) -> None:
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(timeout=self.timeout, limits=self.limits)

    async def close(self) -> None:
        client, self._http_client = self._http_client, None
        if client is not None:
            await client.aclose()

    def invalidate_event_id(self, event_slug: Optional[str] = None) -> None:
        self._event_ids.invalidate(event_slug)

    @property
    def rest_url(self) -> str:
        return f"{self.supabase_url}/rest/v1"

    @property
    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }

    async def request(self, method: str, path: str, **kwargs: Any) -> Any:
        await self.start()
        response = await self._http_client.request(
            method,
            f"{self.rest_url}{path}",
            headers={**self.headers, **kwargs.pop("headers", {})},
            **kwargs,
        )
        if response.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"Supabase request failed with status {response.status_code}: {response.text}",
                request=response.request,
                response=response,
            )
        return response.json() if response.content else None

    async def get_event_id(self, event_slug: str) -> str:
        return await self._event_ids.get_or_load(event_slug, lambda: self._load_event_id(event_slug))

    async def _load_event_id(self, event_slug: str) -> str:
        events = await self.request(
            "GET",
            "/events",
            params={
                "select": "id",
                "slug": f"eq.{event_slug}",
                "limit": "1",
            },
        )
        if events:
            return events[0]["id"]

        events = await self.request(
            "GET",
            "/events",
            params={
                "select": "id",
                "id": f"eq.{event_slug}",
                "limit": "1",
            },
        )
        if events:
            return events[0]["id"]

        raise ValueError(f"Supabase event not found: {event_slug}")


class SupabaseScheduleService:
    """Supabase-backed schedule content boundary."""

    def __init__(
        self,
        *,
        supabase_url: str,
        service_role_key: str,
        event_slug: str,
        schedule_response_model: type[Any],
        schedule_event_model: type[Any],
        admin_schedule_response_model: type[Any],
        admin_schedule_event_model: type[Any],
        timezone_name: str = "America/Toronto",
        client: Optional[SupabaseContentClient] = None,
    ):
        self.client = client or SupabaseContentClient(
            supabase_url=supabase_url,
            service_role_key=service_role_key,
        )
        self.event_slug = event_slug
        self.schedule_response_model = schedule_response_model
        self.schedule_event_model = schedule_event_model
        self.admin_schedule_response_model = admin_schedule_response_model
        self.admin_schedule_event_model = admin_schedule_event_model
        self.timezone = ZoneInfo(timezone_name)
        self._public_cache = AsyncTTLCache(ttl_seconds=30, max_entries=8, stale_if_error_seconds=3600)

    async def _get_event_id(self, event_id: Optional[str] = None) -> str:
        return await self.client.get_event_id(event_id or self.event_slug)

    def _parse_datetime(self, value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        normalized = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=self.timezone)
        return parsed.astimezone(self.timezone)

    def _format_date(self, value: Optional[str]) -> str:
        parsed = self._parse_datetime(value)
        return parsed.date().isoformat() if parsed else ""

    def _format_time(self, value: Optional[str]) -> str:
        parsed = self._parse_datetime(value)
        if not parsed:
            return ""
        hour = parsed.strftime("%I").lstrip("0") or "0"
        return f"{hour}:{parsed.strftime('%M %p')}"

    def _combine_datetime(self, date_value: str, time_value: str) -> Optional[str]:
        if not date_value or not time_value:
            return None

        raw_value = f"{date_value.strip()} {time_value.strip()}"
        formats = (
            "%Y-%m-%d %I:%M %p",
            "%Y-%m-%d %I %p",
            "%Y-%m-%d %H:%M",
            "%m/%d/%Y %I:%M %p",
            "%m/%d/%Y %H:%M",
            "%B %d, %Y %I:%M %p",
        )
        for format_string in formats:
            try:
                parsed = datetime.strptime(raw_value, format_string)
                return parsed.replace(tzinfo=self.timezone).isoformat()
            except ValueError:
                continue
        return None

    def _row_to_schedule_event(self, row: dict[str, Any], *, admin: bool = False, index: int = 0) -> Any:
        model = self.admin_schedule_event_model if admin else self.schedule_event_model
        data = {
            "id": row["id"],
            "title": row.get("title") or "Untitled Event",
            "description": row.get("description") or "",
            "start_date": self._format_date(row.get("starts_at")),
            "start_time": self._format_time(row.get("starts_at")),
            "end_time": self._format_time(row.get("ends_at")),
            "category": row.get("category") or "Event",
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
            "days_active": row.get("days_active") or "",
            "location_name": row.get("location_name"),
        }
        if admin:
            data["row_number"] = index + 2
        return model(**data)

    def _payload_to_row(self, payload: Any, event_id: str) -> dict[str, Any]:
        return {
            "event_id": event_id,
            "title": payload.title.strip(),
            "description": (payload.description or "").strip(),
            "starts_at": self._combine_datetime(payload.start_date, payload.start_time),
            "ends_at": self._combine_datetime(payload.start_date, payload.end_time),
            "category": (payload.category or "Event").strip(),
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "days_active": (payload.days_active or "").strip(),
            "location_name": (payload.location_name or "").strip() or None,
            "source": "admin",
            "status": "published",
        }

    async def _list_rows(self, event_id: Optional[str] = None) -> list[dict[str, Any]]:
        event_id = await self._get_event_id(event_id)
        return await self.client.request(
            "GET",
            "/schedule_items",
            params={
                "select": "*",
                "event_id": f"eq.{event_id}",
                "status": "neq.archived",
                "order": "starts_at.asc.nullslast,sort_order.asc",
            },
        )

    async def list_public_schedule(self, event_id: Optional[str] = None) -> Any:
        resolved_event_id = await self._get_event_id(event_id)
        return await self._public_cache.get_or_load(
            resolved_event_id, lambda: self._load_public_schedule(resolved_event_id),
        )

    async def _load_public_schedule(self, event_id: str) -> Any:
        rows = await self.client.request(
            "GET", "/schedule_items", params={"select": "*", "event_id": f"eq.{event_id}", "status": "neq.archived", "order": "starts_at.asc.nullslast,sort_order.asc"},
        )
        events = [self._row_to_schedule_event(row) for row in rows]
        return self.schedule_response_model(events=events, last_updated=datetime.utcnow(), total_count=len(events))

    def invalidate_public_cache(self, event_id: Optional[str] = None) -> None:
        self._public_cache.invalidate(event_id)

    async def list_admin_schedule(self, event_id: Optional[str] = None) -> Any:
        rows = await self._list_rows(event_id)
        events = [
            self._row_to_schedule_event(row, admin=True, index=index)
            for index, row in enumerate(rows)
        ]
        return self.admin_schedule_response_model(
            events=events,
            last_updated=datetime.utcnow(),
            total_count=len(events),
        )

    async def get_event(self, event_id: str) -> Any:
        rows = await self.client.request(
            "GET",
            "/schedule_items",
            params={
                "select": "*",
                "id": f"eq.{event_id}",
                "limit": "1",
            },
        )
        if not rows:
            return None
        return self._row_to_schedule_event(rows[0])

    async def replace_schedule(self, rows: Any, event_id: Optional[str] = None) -> Any:
        event_id = await self._get_event_id(event_id)
        await self.client.request(
            "DELETE",
            "/schedule_items",
            params={"event_id": f"eq.{event_id}"},
        )
        self.invalidate_public_cache(event_id)

        payload = [self._payload_to_row(row.data, event_id) for row in rows]
        if payload:
            await self.client.request(
                "POST",
                "/schedule_items",
                json=payload,
                headers={"Prefer": "return=minimal"},
            )
        return await self.list_admin_schedule(event_id)

    async def append_event(self, payload: Any, event_id: Optional[str] = None) -> Any:
        event_id = await self._get_event_id(event_id)
        await self.client.request(
            "POST",
            "/schedule_items",
            json=self._payload_to_row(payload, event_id),
            headers={"Prefer": "return=minimal"},
        )
        self.invalidate_public_cache(event_id)
        return await self.list_admin_schedule(event_id)

    async def update_event(
        self,
        schedule_event_id: str,
        payload: Any,
        event_id: Optional[str] = None,
    ) -> Any:
        platform_event_id = await self._get_event_id(event_id)
        await self.client.request(
            "PATCH",
            "/schedule_items",
            params={
                "id": f"eq.{schedule_event_id}",
                "event_id": f"eq.{platform_event_id}",
            },
            json=self._payload_to_row(payload, platform_event_id),
            headers={"Prefer": "return=minimal"},
        )
        self.invalidate_public_cache(platform_event_id)
        return await self.list_admin_schedule(event_id)

    async def clear_event(
        self,
        schedule_event_id: str,
        event_id: Optional[str] = None,
    ) -> Any:
        platform_event_id = await self._get_event_id(event_id)
        await self.client.request(
            "DELETE",
            "/schedule_items",
            params={
                "id": f"eq.{schedule_event_id}",
                "event_id": f"eq.{platform_event_id}",
            },
        )
        self.invalidate_public_cache(platform_event_id)
        return await self.list_admin_schedule(event_id)


class VendorService:
    """Vendor content boundary."""

    def __init__(
        self,
        list_public_vendors: Callable[[], Awaitable[Any]],
        get_vendor: Optional[Callable[[str, Optional[str]], Awaitable[Any]]] = None,
        create_vendor: Optional[Callable[[Any, Optional[str]], Awaitable[Any]]] = None,
        update_vendor: Optional[Callable[[str, Any, Optional[str]], Awaitable[Any]]] = None,
        delete_vendor: Optional[Callable[[str, Optional[str]], Awaitable[Any]]] = None,
    ):
        self._list_public_vendors = list_public_vendors
        self._get_vendor = get_vendor
        self._create_vendor = create_vendor
        self._update_vendor = update_vendor
        self._delete_vendor = delete_vendor

    async def list_public_vendors(self, event_id: Optional[str] = None) -> Any:
        return await self._list_public_vendors()

    async def get_vendor(self, vendor_id: str, event_id: Optional[str] = None) -> Any:
        if not self._get_vendor:
            raise NotImplementedError("Vendor lookup is not available for the active content source")
        return await self._get_vendor(vendor_id, event_id)

    async def create_vendor(self, payload: Any, event_id: Optional[str] = None) -> Any:
        if not self._create_vendor:
            raise NotImplementedError("Vendor creation is not available for the active content source")
        return await self._create_vendor(payload, event_id)

    async def update_vendor(
        self,
        vendor_id: str,
        payload: Any,
        event_id: Optional[str] = None,
    ) -> Any:
        if not self._update_vendor:
            raise NotImplementedError("Vendor updates are not available for the active content source")
        return await self._update_vendor(vendor_id, payload, event_id)

    async def delete_vendor(self, vendor_id: str, event_id: Optional[str] = None) -> Any:
        if not self._delete_vendor:
            raise NotImplementedError("Vendor deletion is not available for the active content source")
        return await self._delete_vendor(vendor_id, event_id)


class SupabaseVendorService:
    """Supabase-backed vendor content boundary."""

    def __init__(
        self,
        *,
        supabase_url: str,
        service_role_key: str,
        event_slug: str,
        vendors_response_model: type[Any],
        vendor_model: type[Any],
        client: Optional[SupabaseContentClient] = None,
    ):
        self.client = client or SupabaseContentClient(
            supabase_url=supabase_url,
            service_role_key=service_role_key,
        )
        self.event_slug = event_slug
        self.vendors_response_model = vendors_response_model
        self.vendor_model = vendor_model
        self._public_cache = AsyncTTLCache(ttl_seconds=180, max_entries=8, stale_if_error_seconds=21600)

    async def _get_event_id(self, event_id: Optional[str] = None) -> str:
        return await self.client.get_event_id(event_id or self.event_slug)

    def _row_to_vendor(self, row: dict[str, Any]) -> Any:
        return self.vendor_model(
            id=row["id"],
            name=row.get("name") or "",
            type=row.get("type") or "",
            location=row.get("location") or "",
            hours_of_operation=row.get("hours_of_operation") or "",
            days_of_operation=row.get("days_of_operation") or "",
            priority=row.get("priority") if row.get("priority") is not None else 99,
        )

    def _payload_to_row(self, payload: Any, event_id: str) -> dict[str, Any]:
        if isinstance(payload, dict):
            get_value = payload.get
        else:
            get_value = lambda key, default=None: getattr(payload, key, default)

        return {
            "event_id": event_id,
            "name": (get_value("name", "") or "").strip(),
            "type": (get_value("type", "") or "").strip(),
            "location": (get_value("location", "") or "").strip(),
            "hours_of_operation": (get_value("hours_of_operation", "") or "").strip(),
            "days_of_operation": (get_value("days_of_operation", "") or "").strip(),
            "priority": get_value("priority", 99) or 99,
            "source": "admin",
            "status": get_value("status", "published") or "published",
        }

    async def _list_rows(self, event_id: Optional[str] = None) -> list[dict[str, Any]]:
        event_id = await self._get_event_id(event_id)
        return await self.client.request(
            "GET",
            "/vendors",
            params={
                "select": "*",
                "event_id": f"eq.{event_id}",
                "status": "neq.archived",
                "order": "priority.asc,name.asc",
            },
        )

    async def list_public_vendors(self, event_id: Optional[str] = None) -> Any:
        resolved_event_id = await self._get_event_id(event_id)
        return await self._public_cache.get_or_load(
            resolved_event_id, lambda: self._load_public_vendors(resolved_event_id),
        )

    async def _load_public_vendors(self, event_id: str) -> Any:
        rows = await self.client.request(
            "GET", "/vendors", params={"select": "*", "event_id": f"eq.{event_id}", "status": "neq.archived", "order": "priority.asc,name.asc"},
        )
        vendors = [self._row_to_vendor(row) for row in rows]
        return self.vendors_response_model(
            vendors=vendors,
            last_updated=datetime.utcnow(),
            total_count=len(vendors),
        )

    def invalidate_public_cache(self, event_id: Optional[str] = None) -> None:
        self._public_cache.invalidate(event_id)

    async def get_vendor(self, vendor_id: str, event_id: Optional[str] = None) -> Any:
        event_id = await self._get_event_id(event_id)
        params = {
            "select": "*",
            "id": f"eq.{vendor_id}",
            "event_id": f"eq.{event_id}",
            "limit": "1",
        }
        rows = await self.client.request(
            "GET",
            "/vendors",
            params=params,
        )
        if not rows:
            return None
        return self._row_to_vendor(rows[0])

    async def create_vendor(self, payload: Any, event_id: Optional[str] = None) -> Any:
        event_id = await self._get_event_id(event_id)
        await self.client.request(
            "POST",
            "/vendors",
            json=self._payload_to_row(payload, event_id),
            headers={"Prefer": "return=minimal"},
        )
        self.invalidate_public_cache(event_id)
        return await self.list_public_vendors(event_id)

    async def update_vendor(
        self,
        vendor_id: str,
        payload: Any,
        event_id: Optional[str] = None,
    ) -> Any:
        event_id = await self._get_event_id(event_id)
        await self.client.request(
            "PATCH",
            "/vendors",
            params={
                "id": f"eq.{vendor_id}",
                "event_id": f"eq.{event_id}",
            },
            json=self._payload_to_row(payload, event_id),
            headers={"Prefer": "return=minimal"},
        )
        self.invalidate_public_cache(event_id)
        return await self.list_public_vendors(event_id)

    async def delete_vendor(self, vendor_id: str, event_id: Optional[str] = None) -> Any:
        event_id = await self._get_event_id(event_id)
        await self.client.request(
            "DELETE",
            "/vendors",
            params={
                "id": f"eq.{vendor_id}",
                "event_id": f"eq.{event_id}",
            },
        )
        self.invalidate_public_cache(event_id)
        return await self.list_public_vendors(event_id)


class SupabaseAnnouncementService:
    """Event-scoped announcement persistence using the platform alerts table."""

    PRIORITY_ORDER = {"Emergency": 0, "Important": 1, "Information": 2}
    PRIORITY_TO_SEVERITY = {
        "Information": "info",
        "Important": "important",
        "Emergency": "emergency",
    }
    SEVERITY_TO_PRIORITY = {value: key for key, value in PRIORITY_TO_SEVERITY.items()}

    def __init__(self, *, supabase_url: str, service_role_key: str, event_slug: str, client: Optional[SupabaseContentClient] = None):
        self.client = client or SupabaseContentClient(
            supabase_url=supabase_url,
            service_role_key=service_role_key,
        )
        self.event_slug = event_slug
        self._public_cache = AsyncTTLCache(ttl_seconds=10, max_entries=8, stale_if_error_seconds=20)

    async def _get_event_id(self, event_id: Optional[str] = None) -> str:
        return await self.client.get_event_id(event_id or self.event_slug)

    def row_to_announcement(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "event_id": row["event_id"],
            "title": row.get("title") or "",
            "message": row.get("message") or "",
            "priority": self.SEVERITY_TO_PRIORITY.get(row.get("severity"), "Information"),
            "expires_at": row.get("expires_at"),
            "created_by": row.get("created_by") or "Unknown organizer",
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "status": row.get("status") or "draft",
        }

    def _sort(self, announcements: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(
            announcements,
            key=lambda item: (
                self.PRIORITY_ORDER.get(item["priority"], 3),
                -(datetime.fromisoformat(str(item["created_at"]).replace("Z", "+00:00")).timestamp()),
            ),
        )

    async def list(self, event_id: Optional[str] = None, *, public: bool = False) -> list[dict[str, Any]]:
        resolved_event_id = await self._get_event_id(event_id)
        if public:
            announcements = await self._public_cache.get_or_load(
                resolved_event_id, lambda: self._load_public_announcements(resolved_event_id),
            )
            return self._currently_public(announcements)
        params = {"select": "*", "event_id": f"eq.{resolved_event_id}"}
        rows = await self.client.request("GET", "/alerts", params=params)
        announcements = [self.row_to_announcement(row) for row in rows]
        return self._sort(announcements)

    async def _load_public_announcements(self, event_id: str) -> list[dict[str, Any]]:
        rows = await self.client.request("GET", "/alerts", params={"select": "*", "event_id": f"eq.{event_id}", "status": "eq.published"})
        return self._sort(self._currently_public([self.row_to_announcement(row) for row in rows]))

    @staticmethod
    def _currently_public(announcements: list[dict[str, Any]]) -> list[dict[str, Any]]:
        now = datetime.now(timezone.utc)
        return [item for item in announcements if item.get("status") == "published" and (not item.get("expires_at") or datetime.fromisoformat(str(item["expires_at"]).replace("Z", "+00:00")) > now)]

    def invalidate_public_cache(self, event_id: Optional[str] = None) -> None:
        self._public_cache.invalidate(event_id)

    async def get(
        self, announcement_id: str, event_id: Optional[str] = None, *, public: bool = False
    ) -> Optional[dict[str, Any]]:
        resolved_event_id = await self._get_event_id(event_id)
        if public:
            announcements = await self._public_cache.get_or_load(
                resolved_event_id, lambda: self._load_public_announcements(resolved_event_id),
            )
            announcements = self._currently_public(announcements)
            return next((item for item in announcements if item["id"] == announcement_id), None)
        params = {
            "select": "*",
            "id": f"eq.{announcement_id}",
            "event_id": f"eq.{resolved_event_id}",
            "limit": "1",
        }
        rows = await self.client.request("GET", "/alerts", params=params)
        if not rows:
            return None
        announcement = self.row_to_announcement(rows[0])
        return announcement

    async def create(self, payload: Any, created_by: str, event_id: Optional[str] = None) -> dict[str, Any]:
        resolved_event_id = await self._get_event_id(event_id)
        rows = await self.client.request(
            "POST", "/alerts",
            json={
                "event_id": resolved_event_id,
                "title": payload.title.strip(),
                "message": payload.message.strip(),
                "severity": self.PRIORITY_TO_SEVERITY[payload.priority],
                "audience": "all",
                "status": payload.status,
                "published_at": datetime.now(timezone.utc).isoformat() if payload.status == "published" else None,
                "expires_at": payload.expires_at.isoformat() if payload.expires_at else None,
                "created_by": created_by,
            },
            headers={"Prefer": "return=representation"},
        )
        self.invalidate_public_cache(resolved_event_id)
        return self.row_to_announcement(rows[0])

    async def update(self, announcement_id: str, payload: Any, event_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        resolved_event_id = await self._get_event_id(event_id)
        body = {
            "title": payload.title.strip(),
            "message": payload.message.strip(),
            "severity": self.PRIORITY_TO_SEVERITY[payload.priority],
            "status": payload.status,
            "expires_at": payload.expires_at.isoformat() if payload.expires_at else None,
        }
        if payload.status == "published":
            body["published_at"] = datetime.now(timezone.utc).isoformat()
        rows = await self.client.request(
            "PATCH", "/alerts",
            params={"id": f"eq.{announcement_id}", "event_id": f"eq.{resolved_event_id}"},
            json=body,
            headers={"Prefer": "return=representation"},
        )
        self.invalidate_public_cache(resolved_event_id)
        return self.row_to_announcement(rows[0]) if rows else None

    async def set_status(self, announcement_id: str, status: str, event_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        resolved_event_id = await self._get_event_id(event_id)
        body: dict[str, Any] = {"status": status}
        if status == "published":
            body["published_at"] = datetime.now(timezone.utc).isoformat()
        rows = await self.client.request(
            "PATCH", "/alerts",
            params={"id": f"eq.{announcement_id}", "event_id": f"eq.{resolved_event_id}"},
            json=body,
            headers={"Prefer": "return=representation"},
        )
        self.invalidate_public_cache(resolved_event_id)
        return self.row_to_announcement(rows[0]) if rows else None

    async def delete(self, announcement_id: str, event_id: Optional[str] = None) -> bool:
        resolved_event_id = await self._get_event_id(event_id)
        rows = await self.client.request(
            "DELETE", "/alerts",
            params={"id": f"eq.{announcement_id}", "event_id": f"eq.{resolved_event_id}"},
            headers={"Prefer": "return=representation"},
        )
        self.invalidate_public_cache(resolved_event_id)
        return bool(rows)


class SupabaseNotificationDeliveryService:
    """Event-scoped persistence for announcement notification attempts."""

    def __init__(self, *, supabase_url: str, service_role_key: str, event_slug: str, client: Optional[SupabaseContentClient] = None):
        self.client = client or SupabaseContentClient(
            supabase_url=supabase_url,
            service_role_key=service_role_key,
        )
        self.event_slug = event_slug

    async def _get_event_id(self, event_id: Optional[str] = None) -> str:
        return await self.client.get_event_id(event_id or self.event_slug)

    async def create_requested(
        self,
        *,
        event_id: str,
        announcement_id: str,
        audience: str,
        requested_by: str,
        target_url: str,
        notification_title: str,
        notification_message: str,
    ) -> dict[str, Any]:
        resolved_event_id = await self._get_event_id(event_id)
        rows = await self.client.request(
            "POST",
            "/notification_deliveries",
            json={
                "event_id": resolved_event_id,
                "announcement_id": announcement_id,
                "audience": audience,
                "provider": "webpushr",
                "status": "requested",
                "requested_by": requested_by,
                "target_url": target_url,
                "notification_title": notification_title,
                "notification_message": notification_message,
            },
            headers={"Prefer": "return=representation"},
        )
        return rows[0]

    async def mark_sent(self, delivery_id: str, provider_campaign_id: str) -> dict[str, Any]:
        rows = await self.client.request(
            "PATCH",
            "/notification_deliveries",
            params={"id": f"eq.{delivery_id}"},
            json={
                "status": "sent",
                "provider_campaign_id": provider_campaign_id,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "error_message": None,
            },
            headers={"Prefer": "return=representation"},
        )
        return rows[0]

    async def mark_failed(self, delivery_id: str, error_message: str) -> dict[str, Any]:
        rows = await self.client.request(
            "PATCH",
            "/notification_deliveries",
            params={"id": f"eq.{delivery_id}"},
            json={"status": "failed", "error_message": error_message[:1000]},
            headers={"Prefer": "return=representation"},
        )
        return rows[0]
