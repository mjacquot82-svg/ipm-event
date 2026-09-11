"""Announcement image upload validation and Supabase Storage helpers.

WonderPush alert.web.image supports JPEG, PNG, and GIF. Uploads are accepted only
through authenticated admin endpoints (Owner|Communications); durable public HTTPS
URLs come from the public ``announcement-images`` Supabase Storage bucket.

Orphan policy:
- Upload returns metadata immediately and does not attach to an announcement until
  create/update persists ``image``.
- Call DELETE /api/admin/announcements/images with the returned ``storage_path``
  when an upload is discarded before save.
- Replace/remove on save deletes the previous storage object when safe.
- Ops may delete objects under announcement-images/ that are older than 24h and
  not referenced by any alerts.image->>'storage_path' (manual SQL / dashboard).
"""
from __future__ import annotations

import struct
import uuid
from typing import Any, Optional
from urllib.parse import quote

import httpx
from pydantic import BaseModel, Field, field_validator

from backend.event_media import https_url

ANNOUNCEMENT_IMAGE_BUCKET = "announcement-images"
ANNOUNCEMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024
ANNOUNCEMENT_IMAGE_MAX_EDGE = 4096
ANNOUNCEMENT_IMAGE_TYPES = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/gif": {".gif"},
}


class AnnouncementImage(BaseModel):
    """Optional announcement image metadata persisted on alerts.image."""

    url: str = Field(max_length=2048)
    alt: str = Field(min_length=1, max_length=300)
    width: int = Field(gt=0, le=10000)
    height: int = Field(gt=0, le=10000)
    storage_path: str = Field(min_length=1, max_length=512)

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        return https_url(value)

    @field_validator("alt")
    @classmethod
    def meaningful_alt(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Image alt text is required")
        return value.strip()

    @field_validator("storage_path")
    @classmethod
    def safe_storage_path(cls, value: str) -> str:
        path = value.strip()
        if (
            not path
            or path.startswith("/")
            or ".." in path
            or "\\" in path
            or any(c.isspace() for c in path)
        ):
            raise ValueError("Invalid storage path")
        return path


class AnnouncementImageDeletePayload(BaseModel):
    storage_path: str = Field(min_length=1, max_length=512)

    @field_validator("storage_path")
    @classmethod
    def safe_storage_path(cls, value: str) -> str:
        return AnnouncementImage.model_validate(
            {
                "url": "https://example.invalid/x",
                "alt": "x",
                "width": 1,
                "height": 1,
                "storage_path": value,
            }
        ).storage_path


def sniff_image_type(data: bytes) -> str:
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if len(data) >= 6 and data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    raise ValueError("Only JPEG, PNG, and GIF images are allowed")


def read_image_dimensions(data: bytes, content_type: str) -> tuple[int, int]:
    if content_type == "image/png":
        if len(data) < 24:
            raise ValueError("Invalid PNG image")
        width, height = struct.unpack(">II", data[16:24])
    elif content_type == "image/gif":
        if len(data) < 10:
            raise ValueError("Invalid GIF image")
        width, height = struct.unpack("<HH", data[6:10])
    elif content_type == "image/jpeg":
        width, height = _jpeg_dimensions(data)
    else:
        raise ValueError("Only JPEG, PNG, and GIF images are allowed")
    if width < 1 or height < 1:
        raise ValueError("Invalid image dimensions")
    if width > ANNOUNCEMENT_IMAGE_MAX_EDGE or height > ANNOUNCEMENT_IMAGE_MAX_EDGE:
        raise ValueError(
            f"Image dimensions must be at most {ANNOUNCEMENT_IMAGE_MAX_EDGE}px on each side"
        )
    return width, height


def _jpeg_dimensions(data: bytes) -> tuple[int, int]:
    index = 2
    length = len(data)
    while index + 9 <= length:
        if data[index] != 0xFF:
            raise ValueError("Invalid JPEG image")
        marker = data[index + 1]
        index += 2
        if marker in (0xD8, 0xD9) or marker == 0x01 or 0xD0 <= marker <= 0xD7:
            continue
        if index + 2 > length:
            raise ValueError("Invalid JPEG image")
        segment_length = struct.unpack(">H", data[index : index + 2])[0]
        if segment_length < 2 or index + segment_length > length:
            raise ValueError("Invalid JPEG image")
        # SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
        if marker in (
            0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
            0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
        ):
            height, width = struct.unpack(">HH", data[index + 3 : index + 7])
            return width, height
        index += segment_length
    raise ValueError("Invalid JPEG image")


def extension_for_type(content_type: str) -> str:
    mapping = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif"}
    if content_type not in mapping:
        raise ValueError("Only JPEG, PNG, and GIF images are allowed")
    return mapping[content_type]


def validate_upload_bytes(
    data: bytes,
    *,
    declared_content_type: Optional[str] = None,
    filename: Optional[str] = None,
) -> tuple[str, int, int]:
    if not data:
        raise ValueError("Image file is required")
    if len(data) > ANNOUNCEMENT_IMAGE_MAX_BYTES:
        raise ValueError("Image must be 5MB or smaller")
    content_type = sniff_image_type(data)
    if declared_content_type:
        normalized = declared_content_type.split(";")[0].strip().lower()
        if normalized == "image/jpg":
            normalized = "image/jpeg"
        if normalized and normalized != content_type:
            raise ValueError("Image content type does not match file contents")
    if filename:
        lower = filename.lower()
        allowed = ANNOUNCEMENT_IMAGE_TYPES[content_type]
        if not any(lower.endswith(ext) for ext in allowed):
            raise ValueError("Image file extension must match JPEG, PNG, or GIF")
    width, height = read_image_dimensions(data, content_type)
    return content_type, width, height


def public_object_url(*, supabase_url: str, storage_path: str) -> str:
    base = supabase_url.rstrip("/")
    encoded = "/".join(quote(part, safe="") for part in storage_path.split("/"))
    return f"{base}/storage/v1/object/public/{ANNOUNCEMENT_IMAGE_BUCKET}/{encoded}"


def build_storage_path(*, event_id: str, content_type: str) -> str:
    safe_event = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in event_id.strip()) or "event"
    return f"{safe_event}/{uuid.uuid4().hex}{extension_for_type(content_type)}"


def image_payload_from_row(value: Any) -> Optional[dict[str, Any]]:
    if value is None:
        return None
    if isinstance(value, AnnouncementImage):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return AnnouncementImage.model_validate(value).model_dump(mode="json")
    return None


class AnnouncementImageStorage:
    """Service-role Supabase Storage client for announcement images."""

    def __init__(self, *, supabase_url: str, service_role_key: str, timeout: float = 30.0):
        self.supabase_url = supabase_url.rstrip("/")
        self.service_role_key = service_role_key
        self.timeout = timeout

    @property
    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
        }

    async def upload(
        self,
        *,
        data: bytes,
        event_id: str,
        alt: str,
        declared_content_type: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> dict[str, Any]:
        content_type, width, height = validate_upload_bytes(
            data,
            declared_content_type=declared_content_type,
            filename=filename,
        )
        storage_path = build_storage_path(event_id=event_id, content_type=content_type)
        url = (
            f"{self.supabase_url}/storage/v1/object/"
            f"{ANNOUNCEMENT_IMAGE_BUCKET}/{quote(storage_path, safe='/')}"
        )
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url,
                headers={
                    **self.headers,
                    "Content-Type": content_type,
                    "x-upsert": "false",
                },
                content=data,
            )
        if response.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"Supabase storage upload failed with status {response.status_code}: {response.text}",
                request=response.request,
                response=response,
            )
        image = AnnouncementImage(
            url=public_object_url(supabase_url=self.supabase_url, storage_path=storage_path),
            alt=alt,
            width=width,
            height=height,
            storage_path=storage_path,
        )
        return image.model_dump(mode="json")

    async def delete(self, storage_path: str) -> None:
        path = AnnouncementImage.model_validate(
            {
                "url": "https://example.invalid/x",
                "alt": "x",
                "width": 1,
                "height": 1,
                "storage_path": storage_path,
            }
        ).storage_path
        url = f"{self.supabase_url}/storage/v1/object/{ANNOUNCEMENT_IMAGE_BUCKET}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.request(
                "DELETE",
                url,
                headers={**self.headers, "Content-Type": "application/json"},
                json={"prefixes": [path]},
            )
        # Missing objects are treated as already cleaned up.
        if response.status_code in (404, 400) and "not found" in (response.text or "").lower():
            return
        if response.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"Supabase storage delete failed with status {response.status_code}: {response.text}",
                request=response.request,
                response=response,
            )

    async def delete_if_present(self, image: Optional[dict[str, Any] | AnnouncementImage]) -> None:
        if not image:
            return
        payload = image_payload_from_row(image)
        if not payload:
            return
        try:
            await self.delete(payload["storage_path"])
        except httpx.HTTPStatusError:
            # Best-effort cleanup must not block announcement writes.
            return
