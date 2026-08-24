import asyncio
from datetime import datetime, timedelta, timezone

from backend.itinerary_reminders import ItineraryReminderEngine
from tests.test_reminder_batching import BatchProvider, BatchRepository


def test_distributed_control_schema_is_atomic_and_service_role_only():
    source = open("supabase/migrations/20260824000400_itinerary_reminder_distributed_controls.sql",
        encoding="utf-8").read()
    assert "for update" in source
    assert "for update of batch skip locked" in source
    assert "acquire_itinerary_provider_slot" in source
    assert "record_itinerary_provider_outcome" in source
    assert "breaker_open_until" in source and "half_open_probe" in source
    assert "mark_itinerary_batch_attempted" in source
    assert "status='delivery_unknown'" in source
    assert "Worker lease expired after provider submission may have begun" in source
    assert "revoke all on function public.acquire_itinerary_provider_slot" in source
    assert "grant execute on function public.acquire_itinerary_provider_slot" in source
    assert "evaluate_itinerary_reminder_alerts" in source
    assert "itinerary_reminder_durable_metrics" in source


def test_expired_pre_submit_batch_is_released_but_post_submit_is_unknown():
    source = open("supabase/migrations/20260824000400_itinerary_reminder_distributed_controls.sql",
        encoding="utf-8").read()
    pre_submit = source[source.index("recover_expired_itinerary_batches"):]
    assert "status='assigned' and lease_expires_at<p_now" in pre_submit
    assert "lease_owner=null" in pre_submit
    assert "status='provider_attempted' and lease_expires_at<p_now" in pre_submit
    assert "itinerary_reminder_deliveries set status='delivery_unknown'" in pre_submit


def test_released_batch_reenters_same_exact_provider_path_once():
    class RecoveryRepository(BatchRepository):
        async def claim_due_batch(self, now, **kwargs): return []
        async def recover_expired_batches(self, now):
            return {"released_pre_submit": 1, "marked_ambiguous": 0}
        async def lease_assigned_batches(self, now, **kwargs):
            return [{"batch_id": "batch-recovered", "delivery_id": "d-1",
                "registration_id": "r-1", "schedule_item_id": "event-a",
                "wonderpush_installation_id": "i-1", "title": "Demo",
                "location_name": None, "starts_at": now + timedelta(minutes=30),
                "idempotency_key": "ipm-t30-existing"}]
    repository, provider = RecoveryRepository(0), BatchProvider()
    result = asyncio.run(ItineraryReminderEngine(repository, provider, delivery_enabled=True,
        max_sends_per_second=1000).run(now=datetime(2026, 9, 22, 14, tzinfo=timezone.utc)))
    assert result["recovery_released_pre_submit"] == 1
    assert result["provider_requests"] == 1 and len(provider.batches) == 1
    assert provider.batches[0]["idempotency_key"] == "ipm-t30-existing"


def test_global_kill_switch_returns_before_recovery_claim_or_provider_control():
    class NoMutationRepository(BatchRepository):
        async def recover_expired_batches(self, now): raise AssertionError("no recovery mutation")
        async def claim_due_batch(self, *args, **kwargs): raise AssertionError("no claim")
    result = asyncio.run(ItineraryReminderEngine(NoMutationRepository(0), BatchProvider(),
        delivery_enabled=False).run(now=datetime(2026, 9, 22, 14, tzinfo=timezone.utc)))
    assert result["kill_switch_enabled"] is True and result["provider_requests"] == 0


def test_database_benchmark_is_10k_synthetic_and_self_cleaning():
    source = open("supabase/migrations/20260824000500_itinerary_reminder_10k_benchmark.sql",
        encoding="utf-8").read()
    assert "generate_series(1,10000)" in source
    assert "itinerary_reminder_synthetic_events" in source
    assert "array[2,4,8]" in source
    assert "explain (analyze,buffers,format json)" in source
    assert "delete from events where id=benchmark_event_id" in source
    assert "schedule_after<>schedule_before" in source
    assert "registrations_after<>registrations_before" in source
    assert "synthetic_cleanup_verified=true" in source
