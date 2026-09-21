"""Small production dependency probe. No repository mutations or provider calls."""
import asyncio
from datetime import datetime, timezone

import httpx
from fastapi import Request, Response
from fastapi.responses import JSONResponse

PRODUCTION_SUPABASE = "https://hppboivlpqkfhhzfftuu.supabase.co"
PRODUCTION_EVENT = "ipm-2026"
CHECK_TIMEOUT_SECONDS = 5


async def check_dependencies(config):
    healthy = False
    # Never send the service credential to an unexpected host/environment.
    if (config["url"].rstrip("/") == PRODUCTION_SUPABASE
            and config["event"] == PRODUCTION_EVENT and config["key"]):
        try:
            async with asyncio.timeout(CHECK_TIMEOUT_SECONDS):
                async with httpx.AsyncClient(timeout=CHECK_TIMEOUT_SECONDS) as client:
                    response = await client.get(
                        f"{PRODUCTION_SUPABASE}/rest/v1/events",
                        params={"select": "slug", "slug": f"eq.{PRODUCTION_EVENT}", "limit": "1"},
                        headers={"apikey": config["key"], "Authorization": f"Bearer {config['key']}"},
                    )
                    response.raise_for_status()
                    healthy = response.json() == [{"slug": PRODUCTION_EVENT}]
        except (httpx.HTTPError, ValueError, TimeoutError):
            # Do not expose upstream response bodies, URLs, or credentials.
            pass
    return (200 if healthy else 503), {
        "status": "healthy" if healthy else "degraded",
        "backend": "ok",
        "supabase": "ok" if healthy else "unavailable",
        "event": PRODUCTION_EVENT,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


def install_routes(router, configuration):
    @router.api_route("/health", methods=["GET", "HEAD"])
    async def system_health(request: Request):
        status, payload = await check_dependencies(configuration())
        headers = {"Cache-Control": "no-store"}
        if request.method == "HEAD":
            return Response(status_code=status, headers=headers)
        return JSONResponse(payload, status_code=status, headers=headers)
