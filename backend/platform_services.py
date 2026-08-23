"""Platform service abstractions.

These services define backend-owned content boundaries for the reusable event
platform. Phase 1 keeps the existing data providers in place and routes calls
through these services so future Supabase-backed implementations can replace
the providers without changing frontend API contracts.
"""

from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
import json
import logging
from typing import Any, Optional
from urllib.parse import quote, urlsplit
from zoneinfo import ZoneInfo

import httpx


logger = logging.getLogger(__name__)


class WonderPushError(Exception):
    """Normalized provider error safe to expose through the admin API."""


class WonderPushClient:
    """Small server-side client for the WonderPush Management API."""

    DELIVERIES_URL = "https://management-api.wonderpush.com/v1/deliveries"

    def __init__(self, *, access_token: str, timeout: float = 10.0):
        self.access_token = access_token
        self.timeout = timeout

    def notification_content(self, title: str, message: str, target_url: str) -> dict[str, str]:
        clean_title = " ".join(title.split())
        branded_title = clean_title if clean_title.casefold().startswith("ipm") else f"IPM — {clean_title}"
        return {
            "title": branded_title,
            "message": " ".join(message.split()),
            "target_url": target_url,
        }

    async def _send(self, *, content: dict[str, str], target: dict[str, str]) -> str:
        notification_target = urlsplit(content["target_url"])
        notification = {
            "alert": {
                "title": content["title"],
                "text": content["message"],
                "targetUrl": content["target_url"],
                "web": {
                    "icon": (
                        f"{notification_target.scheme}://{notification_target.netloc}"
                        "/ipm-icon-any-192.png"
                    ),
                },
            },
            "push": {
                "custom": {
                    "target_url": content["target_url"],
                },
            },
        }
        form = {
            "accessToken": self.access_token,
            "notification": json.dumps(notification, separators=(",", ":")),
            "filterPlatforms": "Web",
            **target,
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(self.DELIVERIES_URL, data=form)
        except httpx.TimeoutException as exc:
            raise WonderPushError("WonderPush request timed out") from exc
        except httpx.RequestError as exc:
            raise WonderPushError("WonderPush could not be reached") from exc

        logger.info(
            "WonderPush delivery response status_code=%s",
            response.status_code,
        )
        if response.status_code != 202:
            raise WonderPushError(f"WonderPush rejected the notification (HTTP {response.status_code})")

        reference = response.headers.get("Location") or response.headers.get("X-Request-Id")
        if not reference:
            try:
                result = response.json()
            except ValueError:
                result = None
            if isinstance(result, dict):
                reference = result.get("id") or result.get("deliveryId")
        return str(reference or "wonderpush:accepted")

    async def send_everyone(self, *, title: str, message: str, target_url: str) -> str:
        content = self.notification_content(title, message, target_url)
        return await self._send(content=content, target={"targetSegmentIds": "@ALL"})

    async def send_test(
        self, *, title: str, message: str, target_url: str, installation_ids: list[str]
    ) -> str:
        if not installation_ids:
            raise WonderPushError("No WonderPush test installation IDs are configured")
        content = self.notification_content(title, message, target_url)
        return await self._send(
            content=content,
            target={"targetInstallationIds": ",".join(installation_ids)},
        )

    async def send_one_installation(
        self, *, title: str, message: str, target_url: str, installation_id: str
    ) -> str:
        """Send to exactly one installation; this method has no broadcast fallback."""
        target = installation_id.strip()
        if not target or "," in target or target == "@ALL":
            raise WonderPushError("Exactly one WonderPush installation ID is required")
        content = self.notification_content(title, message, target_url)
        return await self._send(
            content=content,
            target={"targetInstallationIds": target},
        )

    async def get_installation(self, installation_id: str) -> dict[str, Any] | None:
        url = f"https://management-api.wonderpush.com/v1/installations/{quote(installation_id, safe='')}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url, params={"accessToken": self.access_token, "userId": ""})
        if response.status_code == 404: return None
        if response.status_code != 200:
            raise WonderPushError(f"WonderPush installation lookup failed (HTTP {response.status_code})")
        result = response.json()
        return result if isinstance(result, dict) else None


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
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                f"{self.rest_url}{path}",
                headers={**self.headers, **kwargs.pop("headers", {})},
                timeout=30.0,
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
    ):
        self.client = SupabaseContentClient(
            supabase_url=supabase_url,
            service_role_key=service_role_key,
        )
        self.event_slug = event_slug
        self.schedule_response_model = schedule_response_model
        self.schedule_event_model = schedule_event_model
        self.admin_schedule_response_model = admin_schedule_response_model
        self.admin_schedule_event_model = admin_schedule_event_model
        self.timezone = ZoneInfo(timezone_name)

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
        rows = await self._list_rows(event_id)
        events = [self._row_to_schedule_event(row) for row in rows]
        return self.schedule_response_model(
            events=events,
            last_updated=datetime.utcnow(),
            total_count=len(events),
        )

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

    async def get_calendar_rows(
        self,
        schedule_item_ids: list[str],
        event_id: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Return canonical rows only when every UUID belongs to the current event."""
        platform_event_id = await self._get_event_id(event_id)
        rows = await self.client.request(
            "GET",
            "/schedule_items",
            params={
                "select": "id,title,description,starts_at,ends_at,location_name,updated_at,event_id",
                "event_id": f"eq.{platform_event_id}",
                "id": f"in.({','.join(schedule_item_ids)})",
                "status": "neq.archived",
                "order": "starts_at.asc,id.asc",
            },
        )
        if len(rows) != len(schedule_item_ids):
            return []
        return rows

    async def replace_schedule(self, rows: Any, event_id: Optional[str] = None) -> Any:
        event_id = await self._get_event_id(event_id)
        await self.client.request(
            "DELETE",
            "/schedule_items",
            params={"event_id": f"eq.{event_id}"},
        )

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
    ):
        self.client = SupabaseContentClient(
            supabase_url=supabase_url,
            service_role_key=service_role_key,
        )
        self.event_slug = event_slug
        self.vendors_response_model = vendors_response_model
        self.vendor_model = vendor_model

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
        rows = await self._list_rows(event_id)
        vendors = [self._row_to_vendor(row) for row in rows]
        return self.vendors_response_model(
            vendors=vendors,
            last_updated=datetime.utcnow(),
            total_count=len(vendors),
        )

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

    def __init__(self, *, supabase_url: str, service_role_key: str, event_slug: str):
        self.client = SupabaseContentClient(
            supabase_url=supabase_url,
            service_role_key=service_role_key,
        )
        self.event_slug = event_slug

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
        params = {"select": "*", "event_id": f"eq.{resolved_event_id}"}
        if public:
            params["status"] = "eq.published"
        rows = await self.client.request("GET", "/alerts", params=params)
        announcements = [self.row_to_announcement(row) for row in rows]
        if public:
            now = datetime.now().astimezone()
            announcements = [
                item for item in announcements
                if not item["expires_at"]
                or datetime.fromisoformat(str(item["expires_at"]).replace("Z", "+00:00")) > now
            ]
        return self._sort(announcements)

    async def get(
        self, announcement_id: str, event_id: Optional[str] = None, *, public: bool = False
    ) -> Optional[dict[str, Any]]:
        resolved_event_id = await self._get_event_id(event_id)
        params = {
            "select": "*",
            "id": f"eq.{announcement_id}",
            "event_id": f"eq.{resolved_event_id}",
            "limit": "1",
        }
        if public:
            params["status"] = "eq.published"
        rows = await self.client.request("GET", "/alerts", params=params)
        if not rows:
            return None
        announcement = self.row_to_announcement(rows[0])
        if public and announcement["expires_at"]:
            expiry = datetime.fromisoformat(str(announcement["expires_at"]).replace("Z", "+00:00"))
            if expiry <= datetime.now(timezone.utc):
                return None
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
        return self.row_to_announcement(rows[0]) if rows else None

    async def delete(self, announcement_id: str, event_id: Optional[str] = None) -> bool:
        resolved_event_id = await self._get_event_id(event_id)
        rows = await self.client.request(
            "DELETE", "/alerts",
            params={"id": f"eq.{announcement_id}", "event_id": f"eq.{resolved_event_id}"},
            headers={"Prefer": "return=representation"},
        )
        return bool(rows)


class SupabaseNotificationDeliveryService:
    """Event-scoped persistence for announcement notification attempts."""

    def __init__(self, *, supabase_url: str, service_role_key: str, event_slug: str):
        self.client = SupabaseContentClient(
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
        provider: str = "wonderpush",
    ) -> dict[str, Any]:
        resolved_event_id = await self._get_event_id(event_id)
        rows = await self.client.request(
            "POST",
            "/notification_deliveries",
            json={
                "event_id": resolved_event_id,
                "announcement_id": announcement_id,
                "audience": audience,
                "provider": provider,
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
