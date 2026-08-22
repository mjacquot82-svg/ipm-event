import json
from pathlib import Path
import tempfile
import unittest

from backend.import_mnp_lifestyles_schedule import (
    APPROVED_TARGETS,
    APPROVED_ANNOTATIONS,
    EXPECTED_COUNTS,
    SOURCE,
    classify,
    desired_rows,
    load_manifest,
)


class MnpScheduleImportTests(unittest.TestCase):
    def test_reviewed_manifest_has_exact_counts_and_fields(self):
        manifest = load_manifest()
        self.assertEqual(set(APPROVED_TARGETS.values()), set(manifest["approved_event_slugs"]))
        self.assertEqual(107, len(manifest["events"]))
        counts = {}
        for row in manifest["events"]:
            counts[row["days_active"]] = counts.get(row["days_active"], 0) + 1
            self.assertEqual("MNP Lifestyles Tent Events", row["category"])
            self.assertEqual(APPROVED_ANNOTATIONS.get(row["external_id"]), row["description"])
            self.assertEqual("America/Toronto", row["timezone"])
        self.assertEqual(EXPECTED_COUNTS, counts)

    def test_human_decisions_are_encoded_exactly(self):
        events = {row["external_id"]: row for row in load_manifest()["events"]}
        expected = {
            "2026-09-22-foodland-b9": ("Davis Hill Nursery", "10:45 AM", "11:15 AM", "(1050-1120)"),
            "2026-09-22-foodland-b11": ("Sleepers Bed Gallery", "11:15 AM", "11:45 AM", "(1125-1145)"),
            "2026-09-22-foodland-b25": ("West Shore", "2:45 PM", "3:15 PM", "1510-Makeover"),
            "2026-09-23-foodland-e32": ("Mary Kay / Cheryl McNair", "4:30 PM", "5:00 PM", "1655-Makeover"),
            "2026-09-24-foodland-h11": ("Elgin Jewelers", "11:15 AM", "11:45 AM", "1140-Makeover"),
            "2026-09-25-foodland-k18": ("His Style", "1:00 PM", "1:30 PM", "1325-Makeover"),
        }
        for identity, values in expected.items():
            row = events[identity]
            self.assertEqual(values, (row["title"], row["start_time"], row["end_time"], row["description"]))
        self.assertEqual("4:00 PM", events["2026-09-22-quality-homes-d30"]["start_time"])
        saturday = [row for row in events.values() if row["date"] == "2026-09-26"]
        self.assertTrue(all(row["title"] == "GINA LIVY" and row["location_name"] == "Foodland - Stage" for row in saturday))

    def test_classification_is_idempotent_and_preserves_uuid(self):
        wanted = desired_rows(load_manifest(), "event-uuid")
        existing = [{"id": f"uuid-{index}", **row} for index, row in enumerate(wanted)]
        result = classify(existing, wanted)
        self.assertEqual(107, len(result["UNCHANGED"]))
        self.assertFalse(result["INSERT"] or result["UPDATE"] or result["CONFLICT"])

        changed = [dict(row) for row in existing]
        changed[0]["title"] = "old title"
        result = classify(changed, wanted)
        self.assertEqual("uuid-0", result["UPDATE"][0]["id"])

    def test_identity_collision_is_refused(self):
        wanted = desired_rows(load_manifest(), "event-uuid")[:1]
        existing = [{"id": "other", **wanted[0], "source": "another_source"}]
        self.assertEqual(1, len(classify(existing, wanted)["CONFLICT"]))

    def test_migration_guards_partial_source_identity(self):
        migration = Path("supabase/migrations/20260822000100_schedule_external_identity.sql").read_text()
        self.assertIn("(event_id, source, external_id)", migration)
        self.assertIn("where external_id is not null", migration.lower())

    def test_workbook_checksum_is_enforced(self):
        with tempfile.TemporaryDirectory() as directory:
            bad_workbook = Path(directory) / "wrong.xlsx"
            bad_workbook.write_bytes(b"not the reviewed workbook")
            with self.assertRaisesRegex(RuntimeError, "checksum"):
                load_manifest(workbook_path=bad_workbook)


if __name__ == "__main__":
    unittest.main()
