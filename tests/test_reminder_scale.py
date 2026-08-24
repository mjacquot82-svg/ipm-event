import asyncio
from datetime import datetime, timedelta, timezone

from backend.reminder_scale import (ProviderCircuitBreaker, SlidingWindowRateLimiter,
    classify_provider_failure, simulate_load)
from backend.itinerary_reminders import ItineraryReminderEngine


def test_concrete_load_scenarios_are_repeatable_and_provider_free():
    for size in (100, 1000, 5000, 10000):
        result = simulate_load(size)
        assert result.eligible == size
        assert result.accepted == size
        assert result.late_suppressed > 0
        assert result.unstarred_suppressed > 0
        assert result.unreachable_suppressed > 0
        assert result.duplicate_claims_prevented == 0


def test_two_four_eight_worker_races_never_duplicate_acceptance():
    for workers in (2, 4, 8):
        result = simulate_load(10000, workers=workers)
        assert result.accepted == 10000
        assert result.duplicate_claims_prevented == 10000 * (workers - 1)


def test_default_throttle_quantifies_t30_capacity_limit():
    hundred = simulate_load(100)
    ten_thousand = simulate_load(10000)
    assert hundred.simulated_drain_seconds < 60
    assert ten_thousand.simulated_drain_seconds > 30 * 60
    assert ten_thousand.within_5_minutes_pct < 20


def test_provider_failures_have_honest_retry_classification():
    assert classify_provider_failure(RuntimeError("HTTP 429 rate limit")) == ("provider_failed", "429")
    assert classify_provider_failure(RuntimeError("HTTP 500")) == ("provider_failed", "5xx")
    assert classify_provider_failure(RuntimeError("malformed response")) == ("delivery_unknown", "ambiguous")
    assert classify_provider_failure(RuntimeError("timeout after write")) == ("delivery_unknown", "ambiguous")
    assert classify_provider_failure(ConnectionResetError("connection reset")) == ("delivery_unknown", "ambiguous")


def test_circuit_breaker_opens_and_recovers_half_open():
    now = [0.0]
    breaker = ProviderCircuitBreaker(minimum_calls=4, failure_threshold=.5,
        window_size=4, cooldown_seconds=60, clock=lambda: now[0])
    for success in (False, False, True, False): breaker.record(success)
    assert breaker.state == "open" and not breaker.allow()
    now[0] = 61
    assert breaker.state == "half_open" and breaker.allow()
    breaker.record(True)
    assert breaker.state == "closed"


def test_rate_limiter_applies_backpressure_without_unbounded_fanout():
    now = [0.0]
    async def advance(seconds): now[0] += seconds
    limiter = SlidingWindowRateLimiter(2, clock=lambda: now[0], sleep=advance)
    async def exercise():
        for _ in range(5): await limiter.acquire()
    asyncio.run(exercise())
    assert now[0] >= 2


def test_scale_indexes_cover_claim_and_backlog_shapes():
    source = open("supabase/migrations/20260824000200_itinerary_reminder_scale_indexes.sql", encoding="utf-8").read()
    assert "itinerary_reminder_installations_due_idx" in source
    assert "itinerary_reminder_stars_registration_schedule_idx" in source
    assert "itinerary_reminder_deliveries_backlog_idx" in source
    assert "itinerary_reminder_synthetic_events_due_idx" in source


def test_429_burst_opens_circuit_and_stops_provider_calls():
    class Repository:
        def __init__(self): self.finished = []
        async def close_stale_claims(self, *args, **kwargs): pass
        async def due_registrations(self, *args, **kwargs):
            return [{"registration_id": "reg-0", "wonderpush_installation_id": "installation-0"}]
        async def set_readiness(self, *args, **kwargs): pass
        async def claim_due_batch(self, now, **kwargs):
            return [{"delivery_id": f"delivery-{i}", "registration_id": f"reg-{i}",
                "schedule_item_id": f"event-{i}", "wonderpush_installation_id": f"installation-{i}",
                "title": "Demo", "location_name": None, "starts_at": now + timedelta(minutes=30)}
                for i in range(25)]
        async def get(self, installation_id): return {"provider_deliverable": True}
        async def finish_delivery(self, delivery_id, **values): self.finished.append((delivery_id, values))
        async def assign_batch(self, **values):
            return {"batch_id": f"batch-{values['schedule_item_id']}", "target_count": len(values["delivery_ids"])}
        async def finish_batch(self, batch_id, delivery_ids, **values):
            self.finished.extend((delivery_id, values) for delivery_id in delivery_ids)
    class Provider:
        def __init__(self): self.calls = 0
        async def get_installation(self, installation_id):
            return {"pushToken": {"data": "mock"}, "preferences": {"subscriptionStatus": "optIn"}}
        async def send_installations(self, **kwargs):
            self.calls += 1
            raise RuntimeError("HTTP 429 rate limit exceeded")
    repository, provider = Repository(), Provider()
    engine = ItineraryReminderEngine(repository, provider, delivery_enabled=True,
        concurrency=1, max_sends_per_second=1000)
    class NoWaitLimiter:
        async def acquire(self): pass
        async def defer(self, seconds): pass
    engine.rate_limiter = NoWaitLimiter()
    result = asyncio.run(engine.run(
            now=datetime(2026, 9, 22, 14, 0, tzinfo=timezone.utc)))
    assert result["provider_429"] == 20
    assert result["circuit_breaker"] == "open"
    assert provider.calls == 20
    assert len(repository.finished) == 25
    assert all(item[1]["status"] == "provider_failed" for item in repository.finished)
