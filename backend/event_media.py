"""Optional schedule-detail content. No schedule identity or timing fields."""
from typing import Literal, Optional
from urllib.parse import urlsplit
from pydantic import BaseModel, Field, field_validator, model_serializer


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
    crop: Optional[Literal['top-square']] = None

    @model_serializer(mode='wrap')
    def serialize_image(self, handler):
        data = handler(self)
        if self.crop is None:
            data.pop('crop', None)
        return data

    _url = field_validator('url')(https_url)

    @field_validator('alt')
    @classmethod
    def meaningful_alt(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('Image alt text is required')
        return value.strip()
