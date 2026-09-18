from pathlib import Path
import re


MIGRATION = Path(__file__).parents[1] / "supabase/migrations/20260918000200_stale_favorite_reconciliation.sql"


def test_stale_favorites_are_filtered_without_rejecting_valid_ids():
    source = MIGRATION.read_text()
    assert "item.status='published'" in source
    assert "group by item.id" in source
    assert "on conflict do nothing" in source
    assert re.search(r"not exists\s*\(\s*select 1 from schedule_items item", source)


def test_reconciliation_keeps_unknown_and_cross_event_ids_strict():
    source = MIGRATION.read_text()
    guard = source[source.index("-- A UUID that never belonged"):source.index("-- Reconcile the complete set")]
    assert "raise exception 'Unknown or cross-event Schedule UUID'" in guard
    assert "item.event_id=registration_event_id" in guard


def test_reconciliation_removes_existing_stale_interests_atomically():
    source = MIGRATION.read_text()
    assert "delete from itinerary_reminder_stars star" in source
    assert "last_sync_at=now()" in source
    assert "removed_star_count=removed_star_count+removed_count" in source
