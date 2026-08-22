from collections import Counter
from pathlib import Path
import tempfile
import unittest

from backend.import_ipm_entertainment_schedule import (
    ADMISSION_NOTE,
    BRUCE_LOCATION,
    BRUCE_RV,
    CKNX,
    EXPECTED_COUNTS,
    EXPECTED_TOTAL,
    ONTARIO,
    PRODUCTION_EVENT_SLUG,
    PRODUCTION_PROJECT_REF,
    SOURCE,
    ImportSafetyError,
    classify,
    desired_rows,
    load_manifest,
    target_guard,
)


class EntertainmentScheduleImportTests(unittest.TestCase):
    def test_manifest_has_exact_approved_counts_and_wording(self):
        rows = load_manifest()["events"]
        self.assertEqual(EXPECTED_TOTAL, len(rows))
        self.assertEqual(EXPECTED_COUNTS, dict(Counter(row["category"] for row in rows)))
        self.assertEqual({CKNX, ONTARIO, BRUCE_RV}, {row["category"] for row in rows})
        self.assertTrue(all(row["location_name"] == CKNX for row in rows if row["category"] == CKNX))
        self.assertTrue(all(row["location_name"] == ONTARIO for row in rows if row["category"] == ONTARIO))

    def test_bruce_rv_naming_and_admission_note_are_exact_and_exclusive(self):
        rows = load_manifest()["events"]
        bruce = [row for row in rows if row["category"] == BRUCE_RV]
        other = [row for row in rows if row["category"] != BRUCE_RV]
        self.assertEqual(6, len(bruce))
        self.assertTrue(all(row["location_name"] == BRUCE_LOCATION for row in bruce))
        self.assertTrue(all(row["description"] == ADMISSION_NOTE for row in bruce))
        self.assertTrue(all(row["description"] != ADMISSION_NOTE for row in other))
        self.assertFalse(any("$" in (row["description"] or "") for row in rows))
        self.assertFalse(any("The RV Park" in str(row) for row in rows))

    def test_closing_ceremonies_human_override(self):
        closing = next(row for row in load_manifest()["events"] if row["title"] == "Closing Ceremonies")
        self.assertEqual("2026-09-26", closing["date"])
        self.assertEqual(("4:00 PM", "5:00 PM"), (closing["start_time"], closing["end_time"]))
        self.assertEqual((CKNX, CKNX), (closing["category"], closing["location_name"]))
        self.assertIn("Marc approved 5:00 PM end", closing["source_context"])

    def test_classification_is_idempotent_and_preserves_unrelated_mnp_rows(self):
        wanted = desired_rows(load_manifest(), "staging-event")
        mnp = [{"id": f"mnp-{index}", "source": "mnp_lifestyles_2026_workbook"} for index in range(107)]
        first = classify(mnp, wanted)
        self.assertEqual(39, len(first["INSERT"]))
        self.assertFalse(first["UPDATE"] or first["UNCHANGED"] or first["CONFLICT"])
        existing = mnp + [{"id": f"ent-{index}", **row} for index, row in enumerate(wanted)]
        second = classify(existing, wanted)
        self.assertEqual(39, len(second["UNCHANGED"]))
        self.assertFalse(second["INSERT"] or second["UPDATE"] or second["CONFLICT"])
        self.assertEqual(107, len([row for row in existing if row["source"] == "mnp_lifestyles_2026_workbook"]))

    def test_staging_only_guard_refuses_production_and_unknown_targets(self):
        with self.assertRaisesRegex(ImportSafetyError, "Production"):
            target_guard(PRODUCTION_PROJECT_REF, PRODUCTION_EVENT_SLUG)
        with self.assertRaisesRegex(ImportSafetyError, "Only"):
            target_guard("unknown", "ipm-staging")
        target_guard("hooiqjcbcbwzjjvnwyxf", "ipm-staging")

    def test_source_is_separate_and_pdf_checksum_is_enforced(self):
        self.assertEqual("ipm_entertainment_2026_revised_pdf", SOURCE)
        with tempfile.TemporaryDirectory() as directory:
            wrong_pdf = Path(directory) / "wrong.pdf"
            wrong_pdf.write_bytes(b"not the reviewed PDF")
            with self.assertRaisesRegex(ImportSafetyError, "checksum"):
                load_manifest(pdf_path=wrong_pdf)


if __name__ == "__main__":
    unittest.main()
