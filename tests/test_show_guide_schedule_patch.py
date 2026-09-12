"""Unit tests for staging-only Show Guide schedule patch classifier."""

from __future__ import annotations

import json
from pathlib import Path
import unittest

from backend.apply_show_guide_schedule_patch import (
    LUMBERJACK_LOCATION,
    classify,
    load_patch,
    parse_local,
)

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "frontend/src/data/showGuideScheduleBaseline.staging.json"


class ShowGuideSchedulePatchTests(unittest.TestCase):
    def test_patch_marked_staging_only(self):
        patch = load_patch()
        self.assertTrue(patch["staging_only"])
        self.assertEqual(patch["decisions"]["tbc_hold"]["action"], "DO_NOT_ADD")
        self.assertEqual(patch["decisions"]["bruce_rv_nightly_six"]["action"], "PRESERVE")

    def test_classify_from_public_api_shape_is_not_used(self):
        # Classifier expects schedule_items rows; ensure parse helpers work.
        self.assertTrue(parse_local("2026-09-24", "3:15 PM").startswith("2026-09-24T15:15:00"))

    def test_lumberjack_location_constant(self):
        self.assertEqual(LUMBERJACK_LOCATION, "1A-35-38")

    def test_classify_plan_counts(self):
        patch = load_patch()
        # Synthetic schedule_items-shaped rows
        rows = []
        for date in ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"]:
            for time in ["10:30 AM", "1:00 PM", "3:00 PM"]:
                rows.append({
                    "id": f"lj-{date}-{time}",
                    "title": "Great Canadian Lumberjack Show",
                    "location_name": None,
                    "starts_at": parse_local(date, time),
                })
        rows.append({
            "id": "lavender",
            "title": "Essentially Lavender",
            "location_name": "The Beyond Wireless Stage",
            "starts_at": parse_local("2026-09-24", "2:45 PM"),
            "ends_at": parse_local("2026-09-24", "3:30 PM"),
        })
        plan = classify(rows, patch)
        self.assertEqual(plan["lumberjack_count"], 15)
        self.assertEqual(plan["lavender_count"], 1)
        self.assertEqual(plan["southampton_existing"], 0)
        self.assertEqual(len(plan["inserts"]), 1)
        self.assertEqual(len([u for u in plan["updates"] if u["why"] == "lumberjack_location"]), 15)
        self.assertEqual(len([u for u in plan["updates"] if u["why"] == "essentially_lavender"]), 1)


if __name__ == "__main__":
    unittest.main()
