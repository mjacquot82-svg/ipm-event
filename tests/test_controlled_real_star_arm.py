from pathlib import Path


MIGRATION = Path(
    "supabase/migrations/20260918000100_staging_controlled_real_star_arm.sql"
).read_text()
SERVER = Path("backend/server.py").read_text()
REMINDERS = Path("backend/itinerary_reminders.py").read_text()


def test_controlled_arm_uses_real_star_and_fixture_authorization():
    assert "itinerary_reminder_stars" in MIGRATION
    assert "A real attendee star is required" in MIGRATION
    assert "consumed_at is null and expires_at>p_now" in MIGRATION
    assert "p_staging_guard" in MIGRATION
    assert "Controlled reminder arm is staging-only" in MIGRATION


def test_controlled_arm_is_exactly_once_and_fixture_scoped():
    assert "on conflict (registration_id, schedule_item_id, reminder_type) do nothing" in MIGRATION
    assert "controlled_fixture_id" in MIGRATION
    assert "controlled_lead_minutes" in MIGRATION
    assert "provider_deliverable" in MIGRATION
    assert "provider_reachability='optIn'" in MIGRATION


def test_route_is_staging_only_and_does_not_send():
    assert '"/itinerary-reminders/controlled-test/arm"' in SERVER
    assert "CONTROLLED_T30_ARM_ENABLED = (" in SERVER
    assert "https://staging.theipm.ca" in SERVER
    assert '"provider_send_performed": False' in REMINDERS
    assert '"scheduler_required": False' in REMINDERS


def test_normal_t30_lead_is_unchanged():
    assert "item.starts_at > p_now + interval '25 minutes'" in Path(
        "supabase/migrations/20260823000600_real_itinerary_reminder_engine.sql"
    ).read_text()
    assert "fixture_record.test_lead_minutes" in MIGRATION


def test_real_star_sync_refreshes_bound_provider_readiness_first():
    assert "repository.reconcile_readiness" in SERVER
    assert "require_wonderpush_client()" in SERVER
    assert "stale readiness" in SERVER


def test_arm_window_matches_due_through_one_minute_after_due():
    assert 'item_record.starts_at > p_now + make_interval(mins => fixture_record.test_lead_minutes)' in MIGRATION
    assert 'item_record.starts_at <= p_now + make_interval(mins => fixture_record.test_lead_minutes - 1)' in MIGRATION
