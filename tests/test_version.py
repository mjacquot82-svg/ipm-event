import asyncio

import pytest
from fastapi import HTTPException

from backend import server


def test_staging_version_route_is_get_only():
    route = next(route for route in server.api_router.routes if route.path == "/api/version")
    assert route.methods == {"GET"}


def test_staging_version_returns_render_commit_without_secrets(monkeypatch):
    monkeypatch.setattr(server, "IS_STAGING_DEPLOYMENT", True)
    monkeypatch.setenv("RENDER_GIT_COMMIT", "596a2556d74f433cca70b462a88702380176a42a")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "must-not-leak")
    monkeypatch.setenv("WONDERPUSH_ACCESS_TOKEN", "must-not-leak-either")
    monkeypatch.setenv("MONGODB_URL", "mongodb://must-not-leak")

    result = asyncio.run(server.deployment_version())

    assert result == {
        "environment": "staging",
        "git_commit": "596a2556d74f433cca70b462a88702380176a42a",
        "git_commit_available": True,
    }
    rendered = repr(result)
    assert "must-not-leak" not in rendered
    assert "SUPABASE" not in rendered
    assert "WONDERPUSH" not in rendered
    assert "MONGODB" not in rendered


def test_staging_version_reports_missing_render_commit_honestly(monkeypatch):
    monkeypatch.setattr(server, "IS_STAGING_DEPLOYMENT", True)
    monkeypatch.delenv("RENDER_GIT_COMMIT", raising=False)

    assert asyncio.run(server.deployment_version()) == {
        "environment": "staging",
        "git_commit": None,
        "git_commit_available": False,
    }


def test_version_endpoint_is_not_exposed_outside_staging(monkeypatch):
    monkeypatch.setattr(server, "IS_STAGING_DEPLOYMENT", False)
    monkeypatch.setenv("RENDER_GIT_COMMIT", "production-sha")

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.deployment_version())
    assert error.value.status_code == 404
