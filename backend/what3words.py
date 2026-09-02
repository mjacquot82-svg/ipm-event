# © 2026 1001538341 ONTARIO INC. All Rights Reserved.

import logging
import os
from typing import Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

what3words_router = APIRouter()


class What3WordsLocationResponse(BaseModel):
    words: str
    nearestPlace: Optional[str] = None
    coordinates: Dict[str, float]


def _parse_w3w_coordinate(value: Optional[str], name: str, minimum: float, maximum: float) -> float:
    if value is None or str(value).strip() == "":
        raise HTTPException(status_code=400, detail=f"{name} is required")
    try:
        parsed = float(str(value).strip())
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"Invalid {name}")
    if parsed != parsed or parsed < minimum or parsed > maximum:
        raise HTTPException(status_code=400, detail=f"Invalid {name}")
    return parsed


@what3words_router.get("/what3words", response_model=What3WordsLocationResponse)
async def convert_coordinates_to_what3words(lat: Optional[str] = None, lng: Optional[str] = None):
    """Convert device coordinates to a what3words address via a server-side API key."""
    latitude = _parse_w3w_coordinate(lat, "lat", -90.0, 90.0)
    longitude = _parse_w3w_coordinate(lng, "lng", -180.0, 180.0)

    api_key = (os.environ.get("WHAT3WORDS_API_KEY") or "").strip()
    if not api_key:
        logger.error("What3Words API key is not configured")
        raise HTTPException(status_code=503, detail="Location service is not configured")

    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                "https://api.what3words.com/v3/convert-to-3wa",
                params={"coordinates": f"{latitude},{longitude}", "language": "en"},
                headers={"X-Api-Key": api_key},
                timeout=15.0,
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("what3words request failed: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Unable to convert location") from exc

    if response.status_code >= 400:
        logger.error("what3words API returned status %s", response.status_code)
        raise HTTPException(status_code=502, detail="Unable to convert location")

    try:
        payload = response.json()
    except Exception as exc:
        logger.error("what3words API returned non-JSON")
        raise HTTPException(status_code=502, detail="Unable to convert location") from exc

    words = payload.get("words") if isinstance(payload, dict) else None
    if not isinstance(words, str) or not words.strip():
        raise HTTPException(status_code=502, detail="Unable to convert location")

    raw_coordinates = payload.get("coordinates") if isinstance(payload, dict) else None
    if isinstance(raw_coordinates, dict):
        coord_lat = raw_coordinates.get("lat", latitude)
        coord_lng = raw_coordinates.get("lng", longitude)
        try:
            coord_lat = float(coord_lat)
            coord_lng = float(coord_lng)
        except (TypeError, ValueError):
            coord_lat, coord_lng = latitude, longitude
    else:
        coord_lat, coord_lng = latitude, longitude

    nearest = payload.get("nearestPlace") if isinstance(payload, dict) else None
    return What3WordsLocationResponse(
        words=words.strip(),
        nearestPlace=nearest.strip() if isinstance(nearest, str) and nearest.strip() else None,
        coordinates={"lat": coord_lat, "lng": coord_lng},
    )
