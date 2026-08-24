import asyncio
import json
from datetime import datetime, timedelta, timezone

import pytest
import httpx

from backend.itinerary_reminders import InstallationTargetedWonderPush, ItineraryReminderEngine
from backend.platform_services import WonderPushClient, WonderPushError
from backend.reminder_scale import simulate_batched_load


@pytest.mark.parametrize("size", [100, 1000, 5000, 10000])
@pytest.mark.parametrize("events", [1, 5, 20])
def test_exact_target_scale_shapes(size, events):
    result = simulate_batched_load(size, event_count=events)
    assert result.eligible == size
    assert result.api_requests == min(size, events)
    assert sum(result.batch_sizes) == size
    assert max(result.batch_sizes) <= 10000
    assert result.duplicate_targets == 0
    assert result.within_1_minute_pct == 100


def test_one_event_over_provider_limit_is_chunked():
    result = simulate_batched_load(25000, event_count=1)
    assert result.api_requests == 3
    assert result.batch_sizes == [10000, 10000, 5000]


@pytest.mark.parametrize("workers", [2, 4, 8])
def test_multiworker_batches_keep_each_claim_and_target_unique(workers):
    result = simulate_batched_load(10000, event_count=20, workers=workers)
    assert result.api_requests == 20
    assert result.duplicate_claims_prevented == 10000 * (workers - 1)
    assert result.duplicate_targets == 0


def test_provider_exact_batch_encoding_ttl_and_idempotency(monkeypatch):
    client = WonderPushClient(access_token="secret")
    captured = {}
    async def fake_send(**kwargs):
        captured.update(kwargs)
        return {"provider_delivery_id": "accepted", "status_code": 202, "rate_limit": {}}
    monkeypatch.setattr(client, "_send_detailed", fake_send)
    result = asyncio.run(client.send_installations(title="Starting Soon", message="Demo",
        target_url="https://staging.example/itinerary", installation_ids=["a", "b"],
        idempotency_key="batch-123", expiration_time="10 minutes"))
    assert result["provider_delivery_id"] == "accepted"
    assert captured["target"] == {"targetInstallationIds": "a,b"}
    assert captured["idempotency_key"] == "batch-123"
    assert captured["expiration_time"] == "10 minutes"
    for invalid in ([], ["@ALL"], ["a", "a"], ["a,b"]):
        with pytest.raises(WonderPushError):
            asyncio.run(client.send_installations(title="T", message="M", target_url="https://x",
                installation_ids=invalid, idempotency_key="safe"))
    with pytest.raises(WonderPushError):
        asyncio.run(client.send_installations(title="T", message="M", target_url="https://x",
            installation_ids=[str(i) for i in range(10001)], idempotency_key="safe"))


def test_claim_batch_boundary_rejects_mixed_events_and_duplicate_targets():
    targeter = InstallationTargetedWonderPush(None, BatchProvider())
    base = {"schedule_item_id": "event-a", "title": "A", "location_name": None,
        "starts_at": "2026-09-22T14:30:00Z", "wonderpush_installation_id": "i-a"}
    async def send(claims):
        return await targeter.send_claim_batch(claims=claims, title="T", message="M",
            target_url="https://x", idempotency_key="key", expiration_time="10 minutes")
    with pytest.raises(ValueError):
        asyncio.run(send([base, {**base, "schedule_item_id": "event-b",
            "wonderpush_installation_id": "i-b"}]))
    with pytest.raises(ValueError): asyncio.run(send([base, dict(base)]))


def test_provider_captures_rate_headers_and_retry_after(monkeypatch):
    requests = []
    class FakeAsyncClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            requests.append(kwargs)
            return httpx.Response(429, headers={"X-RateLimit-Limit": "15",
                "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "30", "Retry-After": "2"})
    monkeypatch.setattr("backend.platform_services.httpx.AsyncClient", FakeAsyncClient)
    client = WonderPushClient(access_token="secret")
    with pytest.raises(WonderPushError) as caught:
        asyncio.run(client.send_installations(title="T", message="M", target_url="https://x",
            installation_ids=["a", "b"], idempotency_key="batch-rate"))
    assert caught.value.status_code == 429
    assert caught.value.headers == {"x-ratelimit-limit": "15", "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "30", "retry-after": "2"}
    assert requests[0]["headers"] == {"X-WonderPush-Idempotency-Key": "batch-rate"}
    assert json.loads(requests[0]["data"]["notification"])["push"]["expirationTime"] == "15 minutes"


class BatchRepository:
    def __init__(self, size=100):
        self.size = size
        self.claimed = False
        self.assigned = []
        self.finished = []
    async def close_stale_claims(self, *args, **kwargs): pass
    async def due_registrations(self, *args, **kwargs):
        return [{"registration_id": f"r-{i}", "wonderpush_installation_id": f"i-{i}"}
            for i in range(self.size)]
    async def set_readiness(self, *args, **kwargs): pass
    async def claim_due_batch(self, now, **kwargs):
        if self.claimed: return []
        self.claimed = True
        return [{"delivery_id": f"d-{i}", "registration_id": f"r-{i}",
            "schedule_item_id": "event-a", "wonderpush_installation_id": f"i-{i}",
            "title": "Demo", "location_name": None,
            "starts_at": now + timedelta(minutes=30)} for i in range(self.size)]
    async def assign_batch(self, **values):
        self.assigned.append(values)
        return {"batch_id": "batch-a", "target_count": len(values["delivery_ids"])}
    async def finish_batch(self, batch_id, delivery_ids, **values):
        self.finished.append((batch_id, delivery_ids, values))
    async def recover_expired_batches(self, now): return {"released_pre_submit": 0, "marked_ambiguous": 0}
    async def lease_assigned_batches(self, *args, **kwargs): return []
    async def acquire_provider_slot(self, *args, **kwargs):
        return {"granted": True, "retry_after_ms": 0, "breaker_state": "closed"}
    async def mark_batch_attempted(self, *args, **kwargs): return True
    async def record_provider_outcome(self, *args, **kwargs): return "closed"
    async def evaluate_alerts(self, now): return 0


class BatchProvider:
    def __init__(self): self.batches = []
    async def get_installation(self, installation_id):
        return {"pushToken": {"data": "mock"}, "preferences": {"subscriptionStatus": "optIn"}}
    async def send_installations(self, **values):
        self.batches.append(values)
        return {"provider_delivery_id": "mock", "status_code": 202,
            "rate_limit": {"x-ratelimit-limit": "15", "x-ratelimit-remaining": "14", "x-ratelimit-reset": "4"}}


def test_engine_claims_individually_then_sends_one_exact_event_batch():
    repository, provider = BatchRepository(100), BatchProvider()
    engine = ItineraryReminderEngine(repository, provider, delivery_enabled=True,
        batch_size=10000, max_sends_per_second=1000)
    now = datetime(2026, 9, 22, 14, tzinfo=timezone.utc)
    first = asyncio.run(engine.run(now=now))
    second = asyncio.run(engine.run(now=now))
    assert first["claimed"] == 100 and first["provider_requests"] == 1
    assert first["provider_accepted"] == 100 and second["claimed"] == 0
    assert len(provider.batches) == 1
    assert len(provider.batches[0]["installation_ids"]) == 100
    assert len(set(provider.batches[0]["installation_ids"])) == 100
    assert repository.finished[0][2]["status"] == "provider_accepted"


def test_batch_429_honors_retry_after_and_records_individual_failure():
    class LimitedProvider(BatchProvider):
        async def send_installations(self, **values):
            raise WonderPushError("WonderPush rejected the notification (HTTP 429)",
                status_code=429, headers={"retry-after": "7", "x-ratelimit-remaining": "0"})
    class RecordingLimiter:
        def __init__(self): self.deferred = []
        async def acquire(self): pass
        async def defer(self, seconds): self.deferred.append(seconds)
    repository, provider = BatchRepository(10), LimitedProvider()
    engine = ItineraryReminderEngine(repository, provider, delivery_enabled=True, batch_size=10000)
    limiter = RecordingLimiter()
    engine.rate_limiter = limiter
    now = datetime(2026, 9, 22, 14, tzinfo=timezone.utc)
    result = asyncio.run(engine.run(now=now))
    assert result["provider_429"] == 1 and result["provider_failed"] == 10
    assert limiter.deferred == [7]
    assert repository.finished[0][2]["retry_at"] == now + timedelta(seconds=7)


@pytest.mark.parametrize("failure", [RuntimeError("timeout"), ConnectionResetError("reset"),
    RuntimeError("malformed response")])
def test_ambiguous_batch_failure_is_unknown_without_retry(failure):
    class AmbiguousProvider(BatchProvider):
        async def send_installations(self, **values): raise failure
    repository = BatchRepository(5)
    result = asyncio.run(ItineraryReminderEngine(repository, AmbiguousProvider(),
        delivery_enabled=True, batch_size=10000, max_sends_per_second=1000).run(
            now=datetime(2026, 9, 22, 14, tzinfo=timezone.utc)))
    assert result["delivery_unknown"] == 5
    assert repository.finished[0][2]["retry_at"] is None


def test_batch_schema_is_atomic_event_scoped_and_individually_audited():
    source = open("supabase/migrations/20260824000300_itinerary_reminder_exact_batches.sql",
        encoding="utf-8").read()
    assert "target_count between 1 and 10000" in source
    assert "references public.schedule_items" in source
    assert "delivery.batch_id is null" in source
    assert "delivery.schedule_item_id=p_schedule_item_id" in source
    assert "registration.provider_deliverable" in source
    assert "star.starred_at<item.starts_at-interval '30 minutes'" in source
    assert "assigned_count<>supplied_count" in source
    assert "itinerary_reminder_deliveries_batch_idx" in source
    assert "finish_itinerary_reminder_batch" in source
    assert "attempt_count=attempt_count+1" in source
    assert "idempotency_key=p_idempotency_key" in source
