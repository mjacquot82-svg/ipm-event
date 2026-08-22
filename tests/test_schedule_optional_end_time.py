from types import SimpleNamespace
import unittest

from backend.platform_services import SupabaseScheduleService


class Model:
    def __init__(self, **values):
        self.__dict__.update(values)


class ScheduleOptionalEndTimeTests(unittest.TestCase):
    def setUp(self):
        self.service = SupabaseScheduleService(
            supabase_url="https://staging.invalid",
            service_role_key="test-only",
            event_slug="ipm-staging",
            schedule_response_model=Model,
            schedule_event_model=Model,
            admin_schedule_response_model=Model,
            admin_schedule_event_model=Model,
        )

    def test_blank_payload_end_time_persists_as_null(self):
        payload = SimpleNamespace(
            title="Parade", description="Description", start_date="2026-09-22",
            start_time="10:00 AM", end_time="", category="Parade Week",
            latitude=None, longitude=None, days_active="Tuesday",
            location_name="Parade route coming soon",
        )
        row = self.service._payload_to_row(payload, "staging-event")
        self.assertEqual("2026-09-22T10:00:00-04:00", row["starts_at"])
        self.assertIsNone(row["ends_at"])

    def test_null_database_end_time_is_returned_as_blank(self):
        event = self.service._row_to_schedule_event({
            "id": "parade-1", "title": "Parade", "description": "Description",
            "starts_at": "2026-09-22T10:00:00-04:00", "ends_at": None,
            "category": "Parade Week", "days_active": "Tuesday",
            "location_name": "Parade route coming soon",
        })
        self.assertEqual("10:00 AM", event.start_time)
        self.assertEqual("", event.end_time)

    def test_existing_end_time_round_trips_unchanged(self):
        event = self.service._row_to_schedule_event({
            "id": "existing-1", "title": "Existing", "starts_at": "2026-09-22T10:00:00-04:00",
            "ends_at": "2026-09-22T11:00:00-04:00", "category": "Event", "days_active": "Tuesday",
        })
        self.assertEqual(("10:00 AM", "11:00 AM"), (event.start_time, event.end_time))


if __name__ == "__main__":
    unittest.main()
