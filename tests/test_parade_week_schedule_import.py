from collections import Counter
from pathlib import Path
import tempfile
import unittest

from backend.import_ipm_parade_week_schedule import (
    CATEGORY,
    EXPECTED_TOTAL,
    LOCATION,
    PRODUCTION_EVENT_SLUG,
    PRODUCTION_PROJECT_REF,
    SOURCE,
    ImportSafetyError,
    classify,
    desired_rows,
    load_manifest,
    target_guard,
)


EXPECTED = [
    ("Bruce Power Opening Day Parade", "2026-09-22", "10:00 AM", "Tuesday"),
    ("Trucks and Tractors Parade", "2026-09-23", "11:00 AM", "Wednesday"),
    ("Children’s Parade", "2026-09-24", "11:00 AM", "Thursday"),
    ("Combines Parade", "2026-09-25", "11:00 AM", "Friday"),
    ("Bruce County Farming Through the Ages", "2026-09-26", "11:00 AM", "Saturday"),
]


class ParadeWeekScheduleImportTests(unittest.TestCase):
    def test_manifest_exactly_matches_approved_parade_week_content(self):
        rows = load_manifest()["events"]
        self.assertEqual(EXPECTED_TOTAL, len(rows))
        self.assertEqual(EXPECTED, [(r["title"], r["date"], r["start_time"], r["days_active"]) for r in rows])
        self.assertEqual({CATEGORY: 5}, dict(Counter(r["category"] for r in rows)))
        self.assertTrue(all(r["location_name"] == LOCATION for r in rows))
        self.assertTrue(all(r["end_time"] is None for r in rows))
        self.assertTrue(all(r["description"] for r in rows))

    def test_desired_rows_use_null_end_and_deterministic_source_identity(self):
        rows = desired_rows(load_manifest(), "staging-event")
        self.assertTrue(all(r["ends_at"] is None for r in rows))
        self.assertTrue(all(r["source"] == SOURCE for r in rows))
        self.assertEqual(5, len({r["external_id"] for r in rows}))
        self.assertTrue(all(r["starts_at"].endswith("-04:00") for r in rows))

    def test_classification_is_insert_only_then_idempotent_and_preserves_146(self):
        wanted = desired_rows(load_manifest(), "staging-event")
        approved = [{"id": f"approved-{index}", "source": "approved"} for index in range(146)]
        first = classify(approved, wanted)
        self.assertEqual(5, len(first["INSERT"]))
        self.assertFalse(first["UPDATE"] or first["UNCHANGED"] or first["CONFLICT"])
        existing = approved + [{"id": f"parade-{index}", **row} for index, row in enumerate(wanted)]
        second = classify(existing, wanted)
        self.assertEqual(5, len(second["UNCHANGED"]))
        self.assertFalse(second["INSERT"] or second["UPDATE"] or second["CONFLICT"])
        self.assertEqual(146, len([r for r in existing if r["source"] != SOURCE]))

    def test_staging_guard_refuses_production_and_unknown_targets(self):
        with self.assertRaisesRegex(ImportSafetyError, "Production"):
            target_guard(PRODUCTION_PROJECT_REF, PRODUCTION_EVENT_SLUG)
        with self.assertRaisesRegex(ImportSafetyError, "isolated IPM Staging"):
            target_guard("unknown", "ipm-staging")
        target_guard("hooiqjcbcbwzjjvnwyxf", "ipm-staging")

    def test_poster_checksum_is_enforced(self):
        with tempfile.TemporaryDirectory() as directory:
            wrong = Path(directory) / "wrong.jpg"
            wrong.write_bytes(b"not the reviewed poster")
            with self.assertRaisesRegex(ImportSafetyError, "checksum"):
                load_manifest(poster_path=wrong)


if __name__ == "__main__":
    unittest.main()
