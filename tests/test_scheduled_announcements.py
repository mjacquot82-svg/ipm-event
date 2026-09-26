from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
RUNNER=(ROOT/"backend"/"run_scheduled_announcements.py").read_text()
SERVER=(ROOT/"backend"/"server.py").read_text()
MIGRATION=(ROOT/"supabase"/"migrations"/"20260926000100_scheduled_announcements.sql").read_text()

def test_runner_is_guarded_and_not_enabled_by_default():
    assert 'SCHEDULED_ANNOUNCEMENTS_LIVE":"true"' in RUNNER
    assert "production_guard_failed" in RUNNER
    assert "if args: return 2" in RUNNER

def test_runner_claims_before_broadcast_and_uses_existing_delivery_idempotency():
    assert RUNNER.index("queue.claim") < RUNNER.index("deliveries.create_requested")
    assert RUNNER.index("deliveries.create_requested") < RUNNER.index("provider.send_everyone")
    assert 'idempotency_key=f"announcement-{delivery[\'id\']}"' in RUNNER

def test_runner_only_sends_due_drafts_and_records_terminal_state():
    assert "queue.due(now,EVENT)" in RUNNER
    assert 'item.get("status")!="draft"' in RUNNER
    assert "queue.finish(job[\"id\"],sent=True" in RUNNER
    assert "queue.finish(job[\"id\"],sent=False" in RUNNER

def test_database_prevents_two_active_schedules():
    assert "announcement_scheduled_sends_one_active" in MIGRATION
    assert "where status in ('scheduled','processing')" in MIGRATION

def test_admin_api_requires_draft_and_timezone():
    assert 'announcement.get("status") != "draft"' in SERVER
    assert 'when.tzinfo is None' in SERVER
    assert 'Scheduled time must be before announcement expiry' in SERVER

def test_cancel_only_operates_on_scheduled_rows():
    platform=(ROOT/"backend"/"platform_services.py").read_text()
    cancel=platform[platform.index("async def cancel(self, schedule_id"):platform.index("async def due(",platform.index("async def cancel(self, schedule_id"))]
    assert '"status": "eq.scheduled"' in cancel


def test_test_mode_is_exactly_one_installation_and_never_all():
    assert 'MODE == "test"' in RUNNER
    assert 'len(ids)!=1' in RUNNER
    assert 'ids[0].upper()=="@ALL"' in RUNNER
    assert 'WONDERPUSH_TEST_CAMPAIGN_ID' in RUNNER
    assert 'provider.send_test' in RUNNER

def test_broadcast_mode_remains_separate():
    assert 'MODE not in {"broadcast","test"}' in RUNNER
    assert 'provider.send_everyone' in RUNNER
