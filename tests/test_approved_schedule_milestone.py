import json
import unittest

from backend.apply_approved_schedule_milestone import (
    APPROVED_BLURB_IDS,
    EXPECTED_FOODLAND_COUNT,
    FOODLAND_NEW,
    MilestoneSafetyError,
    build_patch,
    desired_updates,
)


class ApprovedScheduleMilestoneTests(unittest.TestCase):
    def test_authoritative_source_has_exact_approved_targets(self):
        foodland_ids, blurbs = desired_updates()
        self.assertEqual(EXPECTED_FOODLAND_COUNT, len(foodland_ids))
        self.assertEqual(APPROVED_BLURB_IDS, set(blurbs))
        self.assertTrue(all(blurbs.values()))

    def test_patch_changes_only_approved_fields(self):
        foodland_ids, blurbs = desired_updates()
        both = next(external_id for external_id in APPROVED_BLURB_IDS if external_id in foodland_ids)
        row = {"external_id": both, "location_name": "Foodland - Stage", "description": None}
        patch = build_patch(row, foodland_ids, blurbs)
        self.assertEqual({"location_name", "description"}, set(patch))
        self.assertEqual(FOODLAND_NEW, patch["location_name"])
        self.assertNotIn("source", patch)

    def test_existing_unapproved_description_is_never_overwritten(self):
        foodland_ids, blurbs = desired_updates()
        external_id = next(iter(APPROVED_BLURB_IDS))
        with self.assertRaises(MilestoneSafetyError):
            build_patch({"external_id": external_id, "description": "different"}, foodland_ids, blurbs)

    def test_manifest_contains_no_old_foodland_value(self):
        manifest = json.loads(open("backend/import_manifests/mnp_lifestyles_2026.json", encoding="utf-8").read())
        self.assertEqual(0, sum(row.get("location_name") == "Foodland - Stage" for row in manifest["events"]))


if __name__ == "__main__":
    unittest.main()
