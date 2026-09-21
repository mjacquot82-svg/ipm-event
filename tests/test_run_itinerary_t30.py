"""All deliveries below use fake repositories and HTTPX MockTransport only."""
import ast
import asyncio
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import AsyncMock, Mock
from urllib.parse import parse_qs

import httpx
import pytest

from backend import run_itinerary_t30 as worker

ROOT = Path(__file__).resolve().parents[1]
ENV = {
    "ITINERARY_T30_LIVE": "true",
    "DEFAULT_EVENT_ID": "ipm-2026",
    "SUPABASE_URL": "https://hppboivlpqkfhhzfftuu.supabase.co",
    "PUBLIC_APP_URL": "https://theipm.ca",
    "SUPABASE_SERVICE_ROLE_KEY": "fixture-service-role-secret",
    "WONDERPUSH_ACCESS_TOKEN": "fixture-provider-secret",
}


@pytest.fixture
def production_config(monkeypatch):
    for key, value in ENV.items():
        monkeypatch.setenv(key, value)


@pytest.mark.parametrize("name,value", [
    ("ITINERARY_T30_LIVE", None), ("ITINERARY_T30_LIVE", "false"),
    ("ITINERARY_T30_LIVE", "1"), ("ITINERARY_T30_LIVE", "TRUE"),
    ("DEFAULT_EVENT_ID", None), ("DEFAULT_EVENT_ID", "another-event"),
    ("SUPABASE_URL", None), ("SUPABASE_URL", "https://another-project.supabase.co"),
    ("SUPABASE_URL", "http://hppboivlpqkfhhzfftuu.supabase.co"),
    ("SUPABASE_URL", "https://hppboivlpqkfhhzfftuu.supabase.co.evil.invalid"),
    ("SUPABASE_URL", "https://hppboivlpqkfhhzfftuu.supabase.co@evil.invalid"),
    ("PUBLIC_APP_URL", None), ("PUBLIC_APP_URL", "https://staging.theipm.ca"),
    ("PUBLIC_APP_URL", "https://theipm.ca/itinerary"),
    ("SUPABASE_SERVICE_ROLE_KEY", ""), ("WONDERPUSH_ACCESS_TOKEN", ""),
])
def test_guard_failure_performs_no_client_or_engine_work(production_config, monkeypatch, capsys, name, value):
    if value is None: monkeypatch.delenv(name)
    else: monkeypatch.setenv(name, value)
    clients = [Mock(side_effect=AssertionError("No network/claims allowed")) for _ in range(4)]
    for symbol, mock in zip(("SupabaseContentClient", "SupabaseItineraryReminderRepository", "WonderPushClient", "ItineraryReminderEngine"), clients):
        monkeypatch.setattr(worker, symbol, mock)
    assert worker.main() == 2
    for mock in clients: mock.assert_not_called()
    output = capsys.readouterr()
    assert not output.out
    assert json.loads(output.err) == {"status": "blocked", "reason": "production_guard_failed"}


def test_one_cycle_wiring_uses_current_utc_and_exact_production_destination(production_config, monkeypatch, capsys):
    client, repo, provider = object(), object(), object()
    client_factory, repo_factory, provider_factory = Mock(return_value=client), Mock(return_value=repo), Mock(return_value=provider)
    engine = Mock(run=AsyncMock(return_value={"claimed": 0, "provider_accepted": 0, "circuit_breaker": "closed"}))
    engine_factory = Mock(return_value=engine)
    for name, value in [("SupabaseContentClient", client_factory), ("SupabaseItineraryReminderRepository", repo_factory),
                        ("WonderPushClient", provider_factory), ("ItineraryReminderEngine", engine_factory)]:
        monkeypatch.setattr(worker, name, value)
    before = datetime.now(timezone.utc)
    assert worker.main() == 0
    after = datetime.now(timezone.utc)
    client_factory.assert_called_once_with(supabase_url=ENV["SUPABASE_URL"], service_role_key=ENV["SUPABASE_SERVICE_ROLE_KEY"])
    repo_factory.assert_called_once_with(client, "ipm-2026")
    provider_factory.assert_called_once_with(access_token=ENV["WONDERPUSH_ACCESS_TOKEN"])
    engine_factory.assert_called_once_with(repo, provider, delivery_enabled=True, target_url="https://theipm.ca/itinerary")
    engine.run.assert_awaited_once()
    now = engine.run.call_args.kwargs["now"]
    assert now.tzinfo == timezone.utc and before <= now <= after
    assert json.loads(capsys.readouterr().out)["status"] == "complete"


def test_only_safe_aggregate_results_are_printed(monkeypatch, capsys):
    secret = "installation-or-token-must-never-appear"
    async def cycle():
        logging.getLogger("httpx").critical("GET /installations/%s?accessToken=%s", secret, secret)
        logging.getLogger("backend.platform_services").warning(secret)
        return {"claimed": 3, "provider_accepted": 2, "provider_failed": 1,
                "delivery_unknown": 0, "circuit_breaker": secret,
                "installation_ids": [secret], "token": secret, "error": secret,
                "provider_requests": secret, "concurrency": True}
    monkeypatch.setattr(worker, "run_once", cycle)
    assert worker.main() == 1
    output = capsys.readouterr()
    assert secret not in output.out + output.err
    assert json.loads(output.out) == {"claimed": 3, "provider_accepted": 2,
        "provider_failed": 1, "delivery_unknown": 0, "circuit_breaker": "unknown", "status": "partial_failure"}


def test_exception_body_traceback_and_credentials_never_printed(monkeypatch, capsys):
    secret = "secret-installation-and-access-token"
    async def cycle(): raise RuntimeError(secret)
    monkeypatch.setattr(worker, "run_once", cycle)
    assert worker.main() == 1
    output = capsys.readouterr()
    assert not output.out
    assert json.loads(output.err) == {"status": "failed", "reason": "engine_cycle_failed"}
    assert secret not in output.err and "Traceback" not in output.err


@pytest.mark.parametrize("target", ["a" * 40, "@ALL", "a,b", ""])
def test_real_engine_and_provider_only_send_exact_claimed_installations(production_config, monkeypatch, capsys, target):
    repo = Mock(spec=worker.SupabaseItineraryReminderRepository)
    repo.close_stale_claims = AsyncMock()
    repo.due_registrations = AsyncMock(return_value=[{"registration_id": "registered", "wonderpush_installation_id": target}])
    repo.set_readiness = AsyncMock()
    repo.recover_expired_batches = AsyncMock(return_value={})
    repo.lease_assigned_batches = AsyncMock(return_value=[])
    repo.claim_due_batch = AsyncMock(return_value=[{"delivery_id": "durable-claim", "registration_id": "registered",
        "schedule_item_id": "starred-event", "wonderpush_installation_id": target,
        "title": "Claimed event", "starts_at": "2026-09-22T14:00:00Z", "location_name": "Tent"}])
    repo.assign_batch = AsyncMock(return_value={"batch_id": "durable-batch"})
    repo.acquire_provider_slot = AsyncMock(return_value={"granted": True, "breaker_state": "closed"})
    repo.mark_batch_attempted = AsyncMock(return_value=True)
    repo.finish_batch = AsyncMock()
    repo.record_provider_outcome = AsyncMock(return_value="closed")
    repo.evaluate_alerts = AsyncMock(return_value=0)
    monkeypatch.setattr(worker, "SupabaseContentClient", Mock(return_value=object()))
    monkeypatch.setattr(worker, "SupabaseItineraryReminderRepository", Mock(return_value=repo))
    requests = []
    def handler(request):
        requests.append(request)
        if request.method == "GET":
            return httpx.Response(200, json={"preferences": {"subscriptionStatus": "optIn"}, "pushToken": {"data": "fake-push-token"}})
        assert request.method == "POST" and request.url.path == "/v1/deliveries"
        return httpx.Response(202, json={"id": "mock-acceptance"})
    original_client = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original_client(transport=httpx.MockTransport(handler), **kwargs))
    # Any broadcast/single-target fallback invocation fails this test.
    monkeypatch.setattr(worker.WonderPushClient, "send_everyone", AsyncMock(side_effect=AssertionError("Broadcast forbidden")))
    monkeypatch.setattr(worker.WonderPushClient, "send_one_installation", AsyncMock(side_effect=AssertionError("Only claimed batch path allowed")))
    status = worker.main()
    posts = [request for request in requests if request.method == "POST"]
    if target == "a" * 40:
        assert status == 0 and len(posts) == 1
        form = parse_qs(posts[0].content.decode())
        assert form["targetInstallationIds"] == [target]
        assert "targetSegmentIds" not in form and "@ALL" not in posts[0].content.decode()
        assert json.loads(form["notification"][0])["alert"]["targetUrl"] == "https://theipm.ca/itinerary"
        assert posts[0].headers["X-WonderPush-Idempotency-Key"].startswith("ipm-t30-")
    else:
        assert status == 1 and not posts
    repo.claim_due_batch.assert_awaited_once()
    output = capsys.readouterr()
    for secret in ["fake-push-token", ENV["WONDERPUSH_ACCESS_TOKEN"], ENV["SUPABASE_SERVICE_ROLE_KEY"], "durable-claim"]:
        assert secret not in output.out + output.err
    if target: assert target not in output.out + output.err


def test_entrypoint_has_no_scheduler_loop_or_server_import_and_server_switches_stay_off():
    tree = ast.parse((ROOT / "backend/run_itinerary_t30.py").read_text())
    assert not any(isinstance(node, (ast.While, ast.For, ast.AsyncFor)) for node in ast.walk(tree))
    assert not any(isinstance(node, ast.ImportFrom) and node.module and "server" in node.module for node in ast.walk(tree))
    server = ast.parse((ROOT / "backend/server.py").read_text())
    for name in ("ITINERARY_REMINDER_DELIVERY_ENABLED", "ITINERARY_REMINDER_SCHEDULER_ENABLED"):
        assignments = [n for n in server.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in n.targets)]
        assert len(assignments) == 1 and assignments[0].value.value is False


@pytest.mark.parametrize("cwd,args", [(ROOT, ["backend/run_itinerary_t30.py"]), (ROOT / "backend", ["run_itinerary_t30.py"]), (ROOT, ["-m", "backend.run_itinerary_t30"])])
def test_command_import_modes_refuse_missing_live_flag_without_network(cwd, args):
    environment = {**os.environ, **ENV}
    environment.pop("ITINERARY_T30_LIVE", None)
    result = subprocess.run([sys.executable, *args], cwd=cwd, env=environment, text=True, capture_output=True, timeout=10)
    assert result.returncode == 2 and not result.stdout
    assert json.loads(result.stderr) == {"status": "blocked", "reason": "production_guard_failed"}


@pytest.mark.parametrize("arguments", [["--dry-run"], ["--target", "@ALL"], ["--event", "other"]])
def test_unrecognized_arguments_cannot_accidentally_run_live(production_config, monkeypatch, capsys, arguments):
    cycle = AsyncMock(side_effect=AssertionError("No engine cycle allowed"))
    monkeypatch.setattr(worker, "run_once", cycle)
    assert worker.main(arguments) == 2
    cycle.assert_not_called()
    assert json.loads(capsys.readouterr().err) == {"status": "blocked", "reason": "arguments_not_supported"}
