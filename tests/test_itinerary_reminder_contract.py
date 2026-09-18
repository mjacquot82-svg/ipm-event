from pathlib import Path


def test_reminder_contract_is_device_scoped_and_idempotent():
    migration = Path("supabase/migrations/20260823000100_itinerary_reminder_targeting.sql").read_text()
    assert "unique (registration_id, schedule_item_id, reminder_type)" in migration
    assert "on conflict (registration_id, schedule_item_id, reminder_type) do nothing" in migration
    assert "item.status = 'published'" in migration


def test_supabase_full_schedule_replace_is_blocked_to_preserve_ids():
    source = Path("backend/server.py").read_text()
    marker = 'async def import_admin_schedule('
    section = source[source.index(marker):source.index('@api_router.post("/admin/schedule/events"', source.index(marker))]
    assert "Full Schedule replacement is disabled" in section


def test_google_legacy_title_edit_is_blocked_when_it_would_change_the_id():
    source = Path("backend/server.py").read_text()
    section = source[source.index("async def update_schedule_event_row"):source.index("async def clear_schedule_event_row")]
    assert "Changing a Google Sheets event title would change its legacy ID" in section


def test_staging_check_in_reassigns_label_without_provider_send():
    source = Path("backend/itinerary_reminders.py").read_text()
    start = source.index("    async def set_test_label")
    section = source[start:source.index("    async def test_registrations", start)]
    assert '"test_device_label": f"eq.{label}"' in section
    assert '"test_device_label": None' in section
    assert '"event_id": f"eq.{event_id}"' in section
    assert "send_wonderpush" not in section
    assert "if not rows" in section


def test_staging_check_in_route_is_gated_and_explicitly_authorized():
    source = Path("backend/server.py").read_text()
    start = source.index('@api_router.put("/itinerary-reminders/test-device")')
    section = source[start:source.index('@api_router.get("/itinerary-reminders/test-device")', start)]
    assert "controlled_test_identification_enabled" in section
    assert "authorize_itinerary_device" in section
    assert "set_test_label" in section
