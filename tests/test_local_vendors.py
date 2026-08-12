import os
import subprocess
import sys


def test_local_vendor_csv_preview_contract():
    script = """
import asyncio
import httpx
from backend.server import app

async def verify():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/vendors")
        assert response.status_code == 200
        payload = response.json()
        assert payload["total_count"] == 127
        assert len(payload["vendors"]) == 127
        assert {vendor["type"] for vendor in payload["vendors"]} == {"Food", "Indoor", "Outdoor"}
        assert all(vendor["location"] == "" for vendor in payload["vendors"])
        assert all(vendor["hours_of_operation"] == "" for vendor in payload["vendors"])
        assert all(vendor["days_of_operation"] == "" for vendor in payload["vendors"])

asyncio.run(verify())
"""
    env = os.environ.copy()
    env["CONTENT_SOURCE"] = "google_sheets"
    env["LOCAL_VENDORS_CSV"] = "data/ipm-2026-vendors-july15.csv"
    env.pop("SUPABASE_URL", None)
    env.pop("SUPABASE_SERVICE_ROLE_KEY", None)

    subprocess.run([sys.executable, "-c", script], env=env, check=True)
