"""Optional schedule-detail content. No schedule identity or timing fields."""
from typing import Optional
from urllib.parse import urlsplit
from pydantic import BaseModel, Field, field_validator


def https_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or any(c.isspace() for c in value):
        raise ValueError('A public HTTPS URL without credentials is required')
    return value


class EventImage(BaseModel):
    url: str = Field(max_length=2048)
    alt: str = Field(min_length=1, max_length=300)
    width: int = Field(gt=0, le=10000)
    height: int = Field(gt=0, le=10000)

    _url = field_validator('url')(https_url)

    @field_validator('alt')
    @classmethod
    def meaningful_alt(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('Image alt text is required')
        return value.strip()


class EventExternalLink(BaseModel):
    label: str = Field(min_length=1, max_length=150)
    url: str = Field(max_length=2048)

    _url = field_validator('url')(https_url)

    @field_validator('label')
    @classmethod
    def meaningful_label(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('Link label is required')
        return value.strip()


class EventDetailContent(BaseModel):
    event_image: Optional[EventImage] = None
    external_links: list[EventExternalLink] = Field(default_factory=list, max_length=10)


def content_patch(payload):
    """Omitted fields from older admin clients must not erase existing content."""
    fields = getattr(payload, 'model_fields_set', set())
    data = {}
    for key in ('event_image', 'external_links'):
        if key in fields:
            data[key] = payload.model_dump(mode='json')[key]
    return data
