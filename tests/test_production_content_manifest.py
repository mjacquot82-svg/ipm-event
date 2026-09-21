import importlib.util
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "production_content_manifest", ROOT / "backend/publish_content_manifest.py"
)
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


def manifest(schedule=7, announcements=4):
    return {
        "environment": "production",
        "event": "ipm-2026",
        "schedule": {"revision": schedule, "updatedAt": "2026-09-21T00:00:00Z"},
        "announcements": {"revision": announcements, "updatedAt": "2026-09-21T00:00:00Z"},
    }


def test_manifest_gate_skips_redundant_deploy_and_detects_revision_changes():
    assert publisher.manifest_in_sync(manifest(), manifest())
    assert not publisher.manifest_in_sync(manifest(), manifest(schedule=8))


def test_manifest_progression_rejects_identity_and_rollback():
    with pytest.raises(RuntimeError, match="identity"):
        publisher.validate_manifest_progression(
            {**manifest(), "event": "ipm-staging"}, manifest()
        )
    with pytest.raises(RuntimeError, match="rollback"):
        publisher.validate_manifest_progression(manifest(schedule=8), manifest(schedule=7))


def test_lease_acquisition_is_singleton_and_expiry_allows_retry(monkeypatch):
    calls = []

    def fake_env(name):
        return {
            "SUPABASE_URL": "https://hppboivlpqkfhhzfftuu.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        }[name]

    responses = [None, [{"lease_key": publisher.LEASE_KEY}], None, []]

    def fake_request(url, **kwargs):
        calls.append((url, kwargs))
        return responses.pop(0)

    monkeypatch.setattr(publisher, "env", fake_env)
    monkeypatch.setattr(publisher, "json_request", fake_request)
    assert publisher.acquire_lease("owner-a")
    assert not publisher.acquire_lease("owner-b")
    assert sum(kwargs.get("method") == "PATCH" for _, kwargs in calls) == 2


def test_publish_post_is_not_retried_after_unknown_outcome():
    source = (ROOT / "backend/publish_content_manifest.py").read_text()
    assert 'method="POST"' in source
    assert 'retry=False' in source
    assert "compared before every deploy" in source
