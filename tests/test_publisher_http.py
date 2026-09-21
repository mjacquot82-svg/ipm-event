"""Publisher wire-format and safe-diagnostic regression tests.

Run optional real PostgREST checks with IPM_TEST_POSTGREST_BINARY set to a
local PostgREST binary. PostgreSQL is disposable, tmpfs-backed and network-none.
"""
import base64
import hashlib
import hmac
import io
import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

import pytest

from backend import publish_content_manifest as publisher


def test_json_body_declares_json_for_lease_and_netlify_posts(monkeypatch):
    seen = []
    monkeypatch.setattr(publisher, "urlopen", lambda req, **kw: seen.append(req) or io.BytesIO(b'{}'))
    for method in ("POST", "PATCH"):
        publisher.json_request("https://example.invalid", method=method, body={"owner": "host:123:uuid"})
    assert all(req.get_header("Content-type") == "application/json" for req in seen)
    assert all(json.loads(req.data) == {"owner": "host:123:uuid"} for req in seen)


@pytest.mark.parametrize("raw", [False, True])
def test_http_errors_include_stage_status_safe_body_without_credentials(monkeypatch, raw):
    key, token = "test-service-role-secret", "test-netlify-token"
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", key)
    monkeypatch.setenv("NETLIFY_AUTH_TOKEN", token)
    detail = {"code": "PGRST204", "message": f"Unknown column; {key}; {token}",
              "details": "Authorization: Bearer unexpected-token", "hint": "Check Content-Type",
              "Authorization": "Bearer hidden", "apikey": "hidden", "token": "hidden"}
    def request(req, **kwargs):
        raise HTTPError(req.full_url, 400, "Bad Request", {}, io.BytesIO(json.dumps(detail).encode()))
    monkeypatch.setattr(publisher, "urlopen", request)
    call = publisher.raw_request if raw else publisher.json_request
    with pytest.raises(RuntimeError) as caught:
        call("https://example.invalid/?token=do-not-log-url", method="POST", operation="lease insert",
             headers={"Authorization": f"Bearer {key}", "apikey": key}, retry=False)
    message = str(caught.value)
    assert "lease insert POST: HTTP 400" in message
    assert "PGRST204" in message and "Check Content-Type" in message
    for secret in (key, token, "unexpected-token", "hidden", "do-not-log-url"):
        assert secret not in message
    assert caught.value.__suppress_context__


def test_non_json_error_body_and_headers_are_not_dumped(monkeypatch):
    def request(req, **kwargs):
        raise HTTPError(req.full_url, 502, "bad", {"Authorization": "secret"}, io.BytesIO(b'<html>secret</html>'))
    monkeypatch.setattr(publisher, "urlopen", request)
    with pytest.raises(RuntimeError) as caught:
        publisher.json_request("https://example.invalid", retry=False, operation="lease acquire")
    assert "HTTP 502" in str(caught.value)
    assert "non-diagnostic body omitted" in str(caught.value)
    assert "secret" not in str(caught.value)


@pytest.mark.parametrize("failure_stage", ["lease insert", "lease acquire"])
def test_failed_lease_requests_never_read_revisions_or_publish(monkeypatch, capsys, failure_stage):
    monkeypatch.setattr(publisher, "supabase_base", lambda: ("https://example.invalid", "test-key"))
    monkeypatch.setattr(publisher.time, "sleep", lambda _: None)
    requests = []
    def request(req, **kwargs):
        requests.append(req)
        if req.method == "POST" and failure_stage == "lease acquire":
            return io.BytesIO(b'')
        raise HTTPError(req.full_url, 400, "Bad Request", {}, io.BytesIO(b'{"code":"PGRST100","message":"malformed lease request"}'))
    monkeypatch.setattr(publisher, "urlopen", request)
    def forbidden(*args):
        pytest.fail("Failed acquisition must not read revisions or publish")
    monkeypatch.setattr(publisher, "supabase_rows", forbidden)
    monkeypatch.setattr(publisher, "publish", forbidden)
    assert publisher.run_once() == 1
    stderr = capsys.readouterr().err
    assert "OUT OF SYNC" in stderr and failure_stage in stderr and "HTTP 400" in stderr
    assert len(requests) == (3 if failure_stage == "lease insert" else 4)


@pytest.fixture
def postgrest(tmp_path, monkeypatch):
    binary = os.environ.get("IPM_TEST_POSTGREST_BINARY")
    if not binary:
        pytest.skip("Set IPM_TEST_POSTGREST_BINARY for real PostgREST integration")
    name = "ipm-publisher-http-test-" + uuid4().hex[:10]
    socket_dir = tmp_path / "socket"
    socket_dir.mkdir(mode=0o777)
    socket_dir.chmod(0o777)
    subprocess.run(["docker", "run", "-d", "--name", name, "--network", "none",
                    "--tmpfs", "/var/lib/postgresql/data", "-v", f"{socket_dir}:/var/run/postgresql",
                    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine"], check=True, capture_output=True)
    process = None
    log = (tmp_path / "postgrest.log").open("w")
    try:
        for _ in range(100):
            if subprocess.run(["docker", "exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], capture_output=True).returncode == 0:
                break
            time.sleep(.1)
        # Exact existing lease-table definition; no production schema access.
        migration = (Path(__file__).resolve().parents[1] / "supabase/migrations/20260921170000_production_content_revisions.sql").read_text()
        ddl = migration[migration.index("create table if not exists public.content_manifest_publish_leases"):].split("alter table")[0]
        subprocess.run(["docker", "exec", "-i", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], input=ddl, text=True, check=True, capture_output=True)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        secret = "local-fixture-signing-secret-0123456789"
        def encode(value):
            return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b"=")
        unsigned = encode({"alg": "HS256", "typ": "JWT"}) + b"." + encode({"role": "postgres"})
        token = (unsigned + b"." + base64.urlsafe_b64encode(hmac.new(secret.encode(), unsigned, hashlib.sha256).digest()).rstrip(b"=")).decode()
        process = subprocess.Popen([binary], env={**os.environ,
            "PGRST_DB_URI": f"postgresql://postgres@/postgres?host={socket_dir}",
            "PGRST_DB_SCHEMAS": "public", "PGRST_DB_ANON_ROLE": "postgres",
            "PGRST_JWT_SECRET": secret, "PGRST_SERVER_HOST": "127.0.0.1", "PGRST_SERVER_PORT": str(port)}, stdout=log, stderr=log)
        base = f"http://127.0.0.1:{port}"
        for _ in range(100):
            try:
                with urlopen(base, timeout=.2): break
            except OSError: time.sleep(.1)
        else:
            raise AssertionError("Local PostgREST did not start")
        monkeypatch.setattr(publisher, "supabase_base", lambda: (base, token))
        def transport(req, **kwargs):
            # Supabase's gateway strips this prefix before forwarding to PostgREST.
            req = Request(req.full_url.replace("/rest/v1/", "/"), data=req.data,
                          headers=dict(req.header_items()), method=req.method)
            return urlopen(req, **kwargs)
        monkeypatch.setattr(publisher, "urlopen", transport)
        yield base
    finally:
        if process:
            process.terminate()
            process.wait(timeout=10)
        log.close()
        subprocess.run(["docker", "rm", "-f", name], check=True, capture_output=True)


def test_real_postgrest_reproduces_missing_json_content_type_400(postgrest):
    body = json.dumps({"lease_key": publisher.LEASE_KEY, "owner": "render-cron:123:uuid", "lease_until": "2026-09-21T12:00:00+00:00"}).encode()
    request = Request(postgrest + "/content_manifest_publish_leases", data=body,
                      headers={"Accept": "application/json", "Prefer": "resolution=ignore-duplicates"})
    with pytest.raises(HTTPError) as caught:
        urlopen(request)
    assert caught.value.code == 400
    detail = json.loads(caught.value.read())
    assert detail["code"] == "PGRST204"
    print("REPRODUCED original request:", json.dumps(detail))
    with urlopen(postgrest + "/content_manifest_publish_leases") as response:
        assert json.load(response) == []


def test_real_postgrest_fixed_insert_patch_singleton_release(postgrest):
    owner = "render-cron-host:123:12345678-1234-4234-8234-123456789abc"
    assert publisher.acquire_lease(owner)
    assert publisher.acquire_lease(owner)  # idempotent same-owner retry
    assert not publisher.acquire_lease("other-host:456:other-uuid")
    publisher.release_lease("wrong-owner")
    assert not publisher.acquire_lease("other-host:456:other-uuid")
    publisher.release_lease(owner)
    assert publisher.acquire_lease("other-host:456:other-uuid")


@pytest.mark.parametrize("rows", [None, {}, [{}], [{"lease_key": publisher.LEASE_KEY, "owner": "different-owner"}]])
def test_malformed_lease_success_response_cannot_publish(monkeypatch, capsys, rows):
    monkeypatch.setattr(publisher, "supabase_base", lambda: ("https://example.invalid", "test-key"))
    monkeypatch.setattr(publisher, "json_request", lambda *args, **kwargs: rows)
    def forbidden(*args):
        pytest.fail("Malformed lease response must not reach publication")
    monkeypatch.setattr(publisher, "supabase_rows", forbidden)
    monkeypatch.setattr(publisher, "publish", forbidden)
    assert publisher.run_once() == 1
    assert "invalid ownership response" in capsys.readouterr().err


def test_real_postgrest_matching_manifest_run_is_in_sync_without_deploy(postgrest, monkeypatch, capsys):
    monkeypatch.setenv("NETLIFY_SITE_ID", publisher.EXPECTED_NETLIFY_SITE_ID)
    monkeypatch.setattr(publisher, "supabase_rows", lambda: {
        key: {"revision": 1, "updated_at": "2026-09-21T00:00:00Z"}
        for key in ("schedule", "announcements")
    })
    monkeypatch.setattr(publisher, "current_files", lambda _: [{"path": "/content-manifest.json", "sha": "unchanged"}])
    monkeypatch.setattr(publisher, "current_manifest", lambda _: {
        "environment": "production", "event": "ipm-2026",
        "schedule": {"revision": 1}, "announcements": {"revision": 1},
    })
    def forbidden(*args):
        pytest.fail("Matching revisions must not deploy")
    monkeypatch.setattr(publisher, "publish", forbidden)
    assert publisher.run_once() == 0
    assert "IN SYNC" in capsys.readouterr().out


def test_uncertain_netlify_deploy_http_failure_is_not_retried(monkeypatch):
    monkeypatch.setenv("NETLIFY_AUTH_TOKEN", "test-netlify-key")
    calls = []
    def request(req, **kwargs):
        calls.append(req)
        raise HTTPError(req.full_url, 503, "Unavailable", {}, io.BytesIO(b'{"message":"unavailable"}'))
    monkeypatch.setattr(publisher, "urlopen", request)
    with pytest.raises(RuntimeError, match="create Netlify deploy POST: HTTP 503"):
        publisher.publish(publisher.EXPECTED_NETLIFY_SITE_ID, {}, [{"path": "/index.html", "sha": "existing"}])
    assert len(calls) == 1
