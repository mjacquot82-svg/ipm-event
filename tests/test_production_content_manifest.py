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

    responses = [None, [{"lease_key": publisher.LEASE_KEY, "owner": "owner-a"}], None, []]

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


# These tests exercise real urllib response classification and run_once rather
# than replacing the publisher's authoritative-read failure with invented rows.
import io
import json
from urllib.error import HTTPError
from unittest.mock import Mock

JWT = {"code": "PGRST303", "message": "JWT issued at future"}


def jwt_failure(url):
    return HTTPError(url, 401, "Unauthorized", {}, io.BytesIO(json.dumps(JWT).encode()))


def test_publisher_recognizes_future_jwt_and_recovers(monkeypatch):
    calls, sleeps = [], []

    def request(req, **kwargs):
        calls.append(req)
        if len(calls) < 3:
            raise jwt_failure(req.full_url)
        return io.BytesIO(b'[{"revision":8}]')

    monkeypatch.setattr(publisher, "urlopen", request)
    monkeypatch.setattr(publisher.time, "sleep", sleeps.append)
    assert publisher.json_request("https://example.invalid/rest/v1/content_revisions") == [{"revision": 8}]
    assert len(calls) == 3
    assert sleeps == [1, 2]


def test_failed_authoritative_revisions_leave_public_manifest_untouched_and_next_run_recovers(monkeypatch, capsys):
    monkeypatch.setenv("SUPABASE_URL", "https://hppboivlpqkfhhzfftuu.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test")
    monkeypatch.setenv("NETLIFY_SITE_ID", publisher.EXPECTED_NETLIFY_SITE_ID)
    monkeypatch.setattr(publisher, "acquire_lease", lambda owner: True)
    release = Mock()
    monkeypatch.setattr(publisher, "release_lease", release)
    reads, sleeps = [], []
    failing = True

    def request(req, **kwargs):
        if "/events?" in req.full_url:
            return io.BytesIO(b'[{"id":"event","slug":"ipm-2026"}]')
        reads.append(req)
        if failing:
            raise jwt_failure(req.full_url)
        return io.BytesIO(json.dumps([
            {"content_type": key, "revision": value["revision"], "updated_at": value["updatedAt"]}
            for key, value in manifest(schedule=8).items() if isinstance(value, dict)
        ]).encode())

    monkeypatch.setattr(publisher, "urlopen", request)
    monkeypatch.setattr(publisher.time, "sleep", sleeps.append)
    files = Mock(return_value=[{"path": "/content-manifest.json", "sha": "old"}])
    publish = Mock(return_value="new-deploy")
    monkeypatch.setattr(publisher, "current_files", files)
    monkeypatch.setattr(publisher, "current_manifest", lambda _: manifest())
    monkeypatch.setattr(publisher, "publish", publish)
    assert publisher.run_once() == 1
    assert len(reads) == 3 and sleeps == [1, 2]
    assert "OUT OF SYNC" in capsys.readouterr().err
    files.assert_not_called()
    publish.assert_not_called()
    release.assert_called_once()
    failing = False
    assert publisher.run_once() == 0
    assert publish.call_args.args[1] == manifest(schedule=8)


def test_lease_acquisition_failure_is_out_of_sync(monkeypatch, capsys):
    monkeypatch.setattr(publisher, "acquire_lease", Mock(side_effect=RuntimeError("PGRST303 JWT issued at future")))
    publish, release = Mock(), Mock()
    monkeypatch.setattr(publisher, "publish", publish)
    monkeypatch.setattr(publisher, "release_lease", release)
    assert publisher.run_once() == 1
    assert "OUT OF SYNC" in capsys.readouterr().err
    publish.assert_not_called()
    release.assert_not_called()


def test_failed_lease_cleanup_does_not_abort_next_daemon_cycle(monkeypatch):
    monkeypatch.setattr(publisher, "acquire_lease", lambda _: True)
    monkeypatch.setattr(publisher, "supabase_rows", Mock(side_effect=RuntimeError("revision read failed")))
    monkeypatch.setattr(publisher, "release_lease", Mock(side_effect=RuntimeError("PGRST303 JWT issued at future")))
    assert publisher.run_once() == 1
    assert publisher.run_once() == 1


def test_non_transient_401_is_not_retried(monkeypatch):
    request = Mock(side_effect=HTTPError("https://example.invalid", 401, "Unauthorized", {}, io.BytesIO(b'{"code":"PGRST303","message":"JWT expired"}')))
    monkeypatch.setattr(publisher, "urlopen", request)
    with pytest.raises(RuntimeError, match="after 1 attempts"):
        publisher.json_request("https://example.invalid")
    assert request.call_count == 1


def test_publisher_arbitrary_post_is_not_retried_by_default(monkeypatch):
    request = Mock(side_effect=lambda req, **_: (_ for _ in ()).throw(jwt_failure(req.full_url)))
    monkeypatch.setattr(publisher, "urlopen", request)
    with pytest.raises(RuntimeError, match="after 1 attempts"):
        publisher.json_request("https://example.invalid", method="POST", body={})
    assert request.call_count == 1
