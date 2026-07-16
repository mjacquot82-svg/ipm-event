import os
import subprocess
import sys

import pytest


@pytest.mark.parametrize(
    ("environment", "expected_status"),
    [("development", 200), ("production", 404)],
)
def test_api_documentation_availability_depends_on_environment(environment, expected_status):
    script = """
import asyncio
import httpx
from backend.server import app

async def verify():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        for path in ("/docs", "/redoc", "/openapi.json"):
            response = await client.get(path)
            assert response.status_code == EXPECTED_STATUS, (path, response.status_code)

asyncio.run(verify())
""".replace("EXPECTED_STATUS", str(expected_status))
    env = os.environ.copy()
    env["ENVIRONMENT"] = environment

    subprocess.run([sys.executable, "-c", script], env=env, check=True)
