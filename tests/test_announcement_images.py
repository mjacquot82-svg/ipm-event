"""Announcement image upload + WonderPush alert.web.image (mocked; never live-sends)."""
import asyncio
import io
import json
import struct
import zlib
from datetime import datetime, timezone
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from backend import server
from backend.announcement_images import (
    AnnouncementImage,
    AnnouncementImageStorage,
    validate_upload_bytes,
)
from backend.platform_services import WonderPushClient
from tests.test_announcements import (
    FakeWonderPush,
    announcement,
    configure_notification_fakes,
)


def _png(width=8, height=6):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(
            ">I", zlib.crc32(tag + data) & 0xFFFFFFFF
        )

    raw = b"".join(b"\x00" + b"\xff\x00\x00" * width for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def _gif(width=4, height=3):
    return (
        b"GIF89a"
        + struct.pack("<HH", width, height)
        + b"\x00\x00\x00\x2c\x00\x00\x00\x00"
        + struct.pack("<HH", width, height)
        + b"\x00\x02\x02\x44\x01\x00;"
    )


SAMPLE_IMAGE = {
    "url": "https://example.supabase.co/storage/v1/object/public/announcement-images/event-a/abc.png",
    "alt": "Gate closed",
    "width": 8,
    "height": 6,
    "storage_path": "event-a/abc.png",
}


def test_validate_accepts_png_gif_and_rejects_bad_types():
    content_type, width, height = validate_upload_bytes(_png(), declared_content_type="image/png", filename="a.png")
    assert content_type == "image/png"
    assert (width, height) == (8, 6)
    content_type, width, height = validate_upload_bytes(_gif(), filename="a.gif")
    assert content_type == "image/gif"
    with pytest.raises(ValueError, match="JPEG, PNG, and GIF"):
        validate_upload_bytes(b"not-an-image", filename="a.png")
    with pytest.raises(ValueError, match="5MB"):
        validate_upload_bytes(b"\x89PNG\r\n\x1a\n" + b"x" * (5 * 1024 * 1024), filename="a.png")


def test_announcement_image_model_requires_https_and_storage_path():
    AnnouncementImage.model_validate(SAMPLE_IMAGE)
    with pytest.raises(ValidationError):
        AnnouncementImage.model_validate({**SAMPLE_IMAGE, "url": "http://insecure.example/a.png"})
    with pytest.raises(ValidationError):
        AnnouncementImage.model_validate({**SAMPLE_IMAGE, "storage_path": "../escape.png"})


def test_wonderpush_payload_omits_image_when_absent(monkeypatch):
    captured = {}

    class FakeHttpClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            captured.update(url=url, **kwargs)
            return httpx.Response(202, headers={"Location": "/v1/deliveries/d1"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: FakeHttpClient())
    client = WonderPushClient(access_token="token")
    asyncio.run(client.send_everyone(
        title="Title", message="Message", target_url="https://theipm.ca/announcements/a1",
        expiration_time="72 hours",
    ))
    notification = json.loads(captured["data"]["notification"])
    assert notification["alert"]["web"] == {"icon": "https://theipm.ca/ipm-icon-any-192.png"}
    assert "image" not in notification["alert"]["web"]
    assert notification["alert"]["targetUrl"].endswith("/announcements/a1")
    assert captured["data"]["filterPlatforms"] == "Web"


def test_wonderpush_payload_includes_web_image_when_present(monkeypatch):
    captured = {}

    class FakeHttpClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            captured.update(url=url, **kwargs)
            return httpx.Response(202, headers={"Location": "/v1/deliveries/d2"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: FakeHttpClient())
    client = WonderPushClient(access_token="token")
    image_url = SAMPLE_IMAGE["url"]
    asyncio.run(client.send_test(
        title="Title", message="Message", target_url="https://theipm.ca/announcements/a1",
        installation_ids=["inst-1"], image_url=image_url,
        idempotency_key="announcement-test-d2", campaign_id="controlled-test-campaign",
        expiration_time="72 hours",
    ))
    notification = json.loads(captured["data"]["notification"])
    assert notification["alert"]["web"]["icon"] == "https://theipm.ca/ipm-icon-any-192.png"
    assert notification["alert"]["web"]["image"] == image_url
    assert notification["push"]["custom"]["target_url"].endswith("/announcements/a1")
    assert "filterPlatforms" not in captured["data"]


def test_text_only_notify_unchanged(monkeypatch):
    provider, deliveries = configure_notification_fakes(monkeypatch, announcement())
    result = asyncio.run(server.notify_announcement("announcement-1", "everyone", {
        "username": "owner", "role": "Owner", "event_id": "event-a",
    }))
    assert "image_url" not in (provider.everyone_options or {})
    assert result.target_url.endswith("/announcements/announcement-1")
    assert deliveries.rows[0]["notification_title"].startswith("IPM")


def test_notify_with_image_passes_image_url(monkeypatch):
    item = announcement()
    item["image"] = SAMPLE_IMAGE
    provider, _ = configure_notification_fakes(monkeypatch, item)
    asyncio.run(server.notify_announcement("announcement-1", "everyone", {
        "username": "owner", "role": "Owner", "event_id": "event-a",
    }))
    assert provider.everyone_options["image_url"] == SAMPLE_IMAGE["url"]


def test_image_removed_before_send_omits_provider_image(monkeypatch):
    item = announcement()
    item["image"] = None
    provider, _ = configure_notification_fakes(monkeypatch, item)
    asyncio.run(server.notify_announcement("announcement-1", "test", {
        "username": "owner", "role": "Owner", "event_id": "event-a",
    }))
    assert "image_url" not in (provider.test_options or {})


def test_unauthorized_upload_rejected(monkeypatch):
    monkeypatch.setattr(server, "announcement_image_storage", object())

    class FakeUpload:
        content_type = "image/png"
        filename = "a.png"

        async def read(self):
            return _png()

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.upload_announcement_image(
            file=FakeUpload(),
            alt="Gate",
            current_user={"username": "sched", "role": "Schedule", "event_id": "event-a"},
        ))
    assert error.value.status_code == 403


def test_upload_rejects_invalid_and_oversized(monkeypatch):
    class FakeStorage(AnnouncementImageStorage):
        async def upload(self, **kwargs):
            return AnnouncementImageStorage.upload(self, **kwargs)

    storage = AnnouncementImageStorage(supabase_url="https://example.supabase.co", service_role_key="key")

    class FailClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, *args, **kwargs):
            raise AssertionError("should not call storage for invalid bytes")

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: FailClient())
    with pytest.raises(ValueError, match="JPEG, PNG, and GIF"):
        asyncio.run(storage.upload(data=b"hello", event_id="event-a", alt="x", filename="a.txt"))
    with pytest.raises(ValueError, match="5MB"):
        asyncio.run(storage.upload(
            data=b"\xff\xd8\xff" + b"0" * (5 * 1024 * 1024),
            event_id="event-a", alt="x", filename="a.jpg",
        ))


def test_upload_persists_public_url_via_mocked_storage(monkeypatch):
    storage = AnnouncementImageStorage(supabase_url="https://example.supabase.co", service_role_key="key")
    captured = {}

    class FakeHttpClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            captured["url"] = url
            captured["headers"] = kwargs.get("headers")
            captured["content"] = kwargs.get("content")
            return httpx.Response(200, json={"Key": "announcement-images/event-a/x.png"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: FakeHttpClient())
    result = asyncio.run(storage.upload(
        data=_png(), event_id="event-a", alt="Gate closed",
        declared_content_type="image/png", filename="gate.png",
    ))
    assert result["alt"] == "Gate closed"
    assert result["width"] == 8 and result["height"] == 6
    assert result["url"].startswith("https://example.supabase.co/storage/v1/object/public/announcement-images/")
    assert "/announcement-images/" in captured["url"]
    assert captured["headers"]["Authorization"] == "Bearer key"


def test_deep_link_and_targeting_preserved_with_image(monkeypatch):
    item = announcement()
    item["image"] = SAMPLE_IMAGE
    provider, deliveries = configure_notification_fakes(monkeypatch, item)
    result = asyncio.run(server.notify_announcement("announcement-1", "everyone", {
        "username": "owner", "role": "Owner", "event_id": "event-a",
    }))
    assert result.target_url == "https://theipm.ca/announcements/announcement-1"
    assert deliveries.rows[0]["target_url"] == result.target_url
    assert provider.everyone_options["image_url"] == SAMPLE_IMAGE["url"]


def test_unsupported_client_still_receives_title_body_fields(monkeypatch):
    """Image is optional on alert.web; title/text/targetUrl remain for all clients."""
    captured = {}

    class FakeHttpClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, **kwargs):
            captured.update(**kwargs)
            return httpx.Response(202, text="")

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: FakeHttpClient())
    asyncio.run(WonderPushClient(access_token="t").send_everyone(
        title="Hello", message="Body", target_url="https://theipm.ca/announcements/x",
        image_url=SAMPLE_IMAGE["url"],
    ))
    notification = json.loads(captured["data"]["notification"])
    assert notification["alert"]["title"].startswith("IPM")
    assert notification["alert"]["text"] == "Body"
    assert notification["alert"]["targetUrl"].endswith("/announcements/x")
    assert notification["alert"]["web"]["image"] == SAMPLE_IMAGE["url"]
