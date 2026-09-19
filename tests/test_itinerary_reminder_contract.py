from pathlib import Path


def test_reminder_contract_is_device_scoped_and_idempotent():
    migration = Path("supabase/migrations/20260823000100_itinerary_reminder_targeting.sql").read_text()
    assert "unique (registration_id, schedule_item_id, reminder_type)" in migration
    assert "on conflict (registration_id, schedule_item_id, reminder_type) do nothing" in migration
    assert "item.status = 'published'" in migration


def test_existing_schedule_admin_operations_are_preserved():
    import subprocess
    source = Path("backend/server.py").read_text()
    base = subprocess.check_output(["git", "show", "5c41f907821cf11be9c3140d8b8c275c0f9b5c29:backend/server.py"], text=True)
    for start, end in [("async def import_admin_schedule(", '\n\n@api_router.post("/admin/schedule/events"'),
                       ("async def update_schedule_event_row(", "\nasync def clear_schedule_event_row(")]:
        assert source[source.index(start):source.index(end, source.index(start))] == base[base.index(start):base.index(end, base.index(start))]
