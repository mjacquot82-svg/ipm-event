from pathlib import Path

SERVER = Path("backend/server.py").read_text()
REMINDERS = Path("backend/itinerary_reminders.py").read_text()
MIGRATION = Path("supabase/migrations/20260918000300_fix_staging_t30_allowlist_ambiguity.sql").read_text()


def test_staging_gate_is_environment_and_database_scoped():
    assert 'ENVIRONMENT == "staging"' in SERVER
    assert 'hooiqjcbcbwzjjvnwyxf' in SERVER
    assert 'require_staging_allowlist=True' in SERVER


def test_allowlist_claim_is_exact_device_and_event_and_normal_t30():
    assert 'claim_staging_allowlisted_itinerary_reminder' in REMINDERS
    assert 'registration_id' in MIGRATION and 'schedule_item_id' in MIGRATION
    assert "reminder_type = 'itinerary_t30'" in MIGRATION
    assert "starts_at > p_now + interval '25 minutes'" in MIGRATION
    assert "starts_at <= p_now + interval '30 minutes'" in MIGRATION
    assert 'provider_deliverable' in MIGRATION


def test_gate_fails_closed_and_shuts_off_after_one_claim():
    assert 'if len(rows) != 1:' in REMINDERS
    assert 'if not found then return;' in MIGRATION
    assert 'claimed_count = 1, enabled = false' in MIGRATION
    assert 'expires_at > p_now' in MIGRATION


def test_claim_function_qualifies_all_rows_and_assigns_outputs_explicitly():
    assert "from public.staging_t30_allowlists as g" in MIGRATION
    assert "from public.itinerary_reminder_installations as r" in MIGRATION
    assert "from public.schedule_items as i" in MIGRATION
    assert "from public.itinerary_reminder_stars as s" in MIGRATION
    assert "from public.itinerary_reminder_deliveries as d" in MIGRATION
    assert "registration_id := reg_row.id" in MIGRATION
    assert "schedule_item_id := item_row.id" in MIGRATION
