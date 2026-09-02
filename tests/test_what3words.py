import asyncio

import pytest
from fastapi import HTTPException

from backend import what3words

def test_what3words_rejects_invalid_coordinates():
    with pytest.raises(HTTPException) as raised:
        what3words._parse_w3w_coordinate("not-a-number", "lat", -90, 90)

    assert raised.value.status_code == 400
    assert raised.value.detail == "Invalid lat"


def test_what3words_requires_server_side_key(monkeypatch):
    monkeypatch.delenv("WHAT3WORDS_API_KEY", raising=False)

    with pytest.raises(HTTPException) as raised:
        asyncio.run(what3words.convert_coordinates_to_what3words("44.1", "-81.2"))

    assert raised.value.status_code == 503
    assert raised.value.detail == "Location service is not configured"
    assert "WHAT3WORDS_API_KEY" not in raised.value.detail


def test_what3words_proxies_coordinates_without_exposing_key(monkeypatch):
    captured = {}

    class FakeResponse:
        status_code = 200

        @staticmethod
        def json():
            return {
                "words": "filled.count.soap",
                "nearestPlace": "Bruce County",
                "coordinates": {"lat": 44.1, "lng": -81.2},
            }

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url, **kwargs):
            captured.update(url=url, **kwargs)
            return FakeResponse()

    monkeypatch.setenv("WHAT3WORDS_API_KEY", "server-only-test-key")
    monkeypatch.setattr(what3words.httpx, "AsyncClient", FakeAsyncClient)

    response = asyncio.run(what3words.convert_coordinates_to_what3words("44.1", "-81.2"))

    assert response.model_dump() == {
        "words": "filled.count.soap", "nearestPlace": "Bruce County",
        "coordinates": {"lat": 44.1, "lng": -81.2},
    }
    assert captured["url"] == "https://api.what3words.com/v3/convert-to-3wa"
    assert captured["params"] == {"coordinates": "44.1,-81.2", "language": "en"}
    assert captured["headers"] == {"X-Api-Key": "server-only-test-key"}
    assert "server-only-test-key" not in response.model_dump_json()
