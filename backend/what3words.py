"""Transient attendee-requested location conversion; no location logging/storage."""
import asyncio
from collections import OrderedDict, deque
import hashlib
import json
import math
import os
import re
import secrets
import time
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request as ProviderRequest, build_opener

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

what3words_router = APIRouter()
MAX_BODY_BYTES = 256
MAX_PROVIDER_BYTES = 16384
NO_STORE = {"Cache-Control": "no-store", "Pragma": "no-cache"}
ALLOWED_ORIGINS = {"https://theipm.ca", "https://www.theipm.ca", "https://staging.theipm.ca"}


class ConversionBudget:
    """Single-instance limits; only salted client hashes/timestamps live in RAM."""
    def __init__(self):
        self.salt = secrets.token_bytes(32)
        self.clients = OrderedDict()
        self.total = deque()

    def allow(self, client, now=None):
        now = time.monotonic() if now is None else now
        while self.total and self.total[0] <= now - 60:
            self.total.popleft()
        for key in list(self.clients):
            if self.clients[key][-1] <= now - 60:
                del self.clients[key]
        key = hashlib.blake2b(client.encode(), key=self.salt, digest_size=16).digest()
        attempts = self.clients.get(key, deque())
        while attempts and attempts[0] <= now - 60:
            attempts.popleft()
        if len(attempts) >= 6 or len(self.total) >= 60:
            return False
        self.total.append(now)
        attempts.append(now)
        self.clients[key] = attempts
        return True


budget = ConversionBudget()
provider_slots = asyncio.Semaphore(2)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward the secret or coordinates to a redirect destination.
        return None


def provider_lookup(latitude, longitude, api_key):
    # what3words supports GET conversion. urllib has no HTTP URL logger, unlike
    # httpx's INFO request logger. Never log/propagate its response or exception.
    query = urlencode({"coordinates": f"{latitude},{longitude}", "language": "en"})
    request = ProviderRequest("https://api.what3words.com/v3/convert-to-3wa?" + query,
                              headers={"X-Api-Key": api_key})
    with build_opener(NoRedirect()).open(request, timeout=15) as response:
        if response.status != 200:
            raise ValueError("Provider unavailable")
        raw = response.read(MAX_PROVIDER_BYTES + 1)
        if len(raw) > MAX_PROVIDER_BYTES:
            raise ValueError("Provider unavailable")
    payload = json.loads(raw)
    words = payload.get("words") if isinstance(payload, dict) else None
    if not isinstance(words, str) or not re.fullmatch(r"[a-z]{1,64}\.[a-z]{1,64}\.[a-z]{1,64}", words):
        raise ValueError("Provider unavailable")
    nearest = payload.get("nearestPlace")
    if not isinstance(nearest, str) or len(nearest) > 128 or any(c.isdigit() for c in nearest):
        nearest = None
    result = {"words": words, "nearestPlace": nearest}
    if api_key in json.dumps(result):
        raise ValueError("Provider unavailable")
    # Do not return provider coordinates/bounds/map URL or any arbitrary fields.
    return result


def reply(status, detail):
    return JSONResponse({"detail": detail}, status_code=status, headers=NO_STORE)


async def read_coordinates(request):
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_BODY_BYTES:
            raise OverflowError
        body.extend(chunk)
    data = json.loads(body)
    if not isinstance(data, dict) or set(data) != {"lat", "lng"}:
        raise ValueError
    lat, lng = data["lat"], data["lng"]
    if any(type(v) not in (int, float) or not math.isfinite(v) for v in (lat, lng)):
        raise ValueError
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ValueError
    return lat, lng


@what3words_router.post("/what3words")
async def convert_coordinates_to_what3words(request: Request):
    # Public attendee tool, not an organizer operation: no login/permission loop.
    # Fixed route, bounded input, origin guard and request budget protect the key.
    try:
        origin = request.headers.get("origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return reply(403, "Location lookup is unavailable from this site")
        if not budget.allow(request.client.host if request.client else "unknown"):
            response = reply(429, "Please wait a minute before trying again")
            response.headers["Retry-After"] = "60"
            return response
        if request.url.query:
            return reply(400, "Use the location request body")
        if request.headers.get("content-type", "").split(";")[0].strip() != "application/json":
            return reply(415, "Location request must be JSON")
        length = request.headers.get("content-length")
        if length and (not length.isdigit() or int(length) > MAX_BODY_BYTES):
            return reply(413, "Location request is too large")
        try:
            lat, lng = await asyncio.wait_for(read_coordinates(request), timeout=3)
        except OverflowError:
            return reply(413, "Location request is too large")
        except Exception:
            return reply(400, "Invalid location coordinates")
        api_key = (os.environ.get("WHAT3WORDS_API_KEY") or "").strip()
        if not api_key:
            return reply(503, "Location service is not configured")
        if provider_slots.locked():
            return reply(503, "Location lookup is busy. Please try again")
        async with provider_slots:
            result = await asyncio.to_thread(provider_lookup, lat, lng, api_key)
        return JSONResponse(result, headers=NO_STORE)
    except Exception:
        # Deliberately no logger, exception message, traceback, request or body.
        return reply(502, "Unable to convert location")
