import json
from pathlib import Path
import tempfile
import unittest

from backend.import_mnp_lifestyles_schedule import (
    APPROVED_TARGETS,
    APPROVED_DESCRIPTIONS,
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
            self.assertEqual(APPROVED_DESCRIPTIONS.get(row["external_id"]), row["description"])
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
        self.assertTrue(all(row["title"] == "GINA LIVY" and row["location_name"] == "The Beyond Wireless Stage" for row in saturday))

    def test_multiline_workbook_content_is_preserved_exactly(self):
        events = {row["external_id"]: row for row in load_manifest()["events"]}
        expected = {
            "2026-09-22-foodland-b6": ("Start of Day Movement", "Definition Fitness"),
            "2026-09-22-foodland-b7": ("Home and Garden", "Aaniin Collective"),
            "2026-09-22-foodland-b14": ("Food and Drink", "Greenock Collective"),
            "2026-09-22-foodland-b18": ("meat smoking", "Liesemer Home Hardware"),
            "2026-09-22-foodland-b21": ("Photography Bietz Studio", "Fashion"),
            "2026-09-22-foodland-b23": ("MakeUp Artist", "Hayley Wilhem"),
            "2026-09-22-foodland-b28": ("Wellness", "The Space Between\nAlicia Gibbons"),
            "2026-09-22-foodland-b30": ("Nature Babes", "Amanada Butchart"),
            "2026-09-22-foodland-b32": ("The WOMB", "Rebecca Grubb & Jess Connor"),
            "2026-09-22-harleys-c7": ("DK Salon", "DK Salon is a locally owned hair salon, operated by Jenna Freiburger, offering professional hairstyling in a welcoming, personalized setting."),
            "2026-09-22-harleys-c19": ("Charcuterie Sampling Harley's", None),
            "2026-09-22-quality-homes-d18": ("MakeUp Artist", "Hayley Wilhelm"),
            "2026-09-22-quality-homes-d22": ("Pilates Demo", "Chelsea\nAll Bodies"),
            "2026-09-22-quality-homes-d30": ("Shroom Soda", "West Shore"),
            "2026-09-23-foodland-e7": ("Wellness", "Essential Wellness\nLiza Weltz"),
            "2026-09-23-foodland-e9": ("Evergreen Connections", "Rachel Stroeder"),
            "2026-09-23-foodland-e12": ("Art Studio", "Susan Seitz"),
            "2026-09-23-foodland-e14": ("Home and Garden", "Ruth Montgomery (Energy in the Home)"),
            "2026-09-23-foodland-e21": ("furniture refresh", "Willow Home"),
            "2026-09-23-foodland-e28": ("Fashion", "J&H Womens Fashions"),
            "2026-09-23-harleys-f7": ("Wood Working", "Mark Grubb"),
            "2026-09-23-harleys-f21": ("Simply Potts", "by Lauriss"),
            "2026-09-23-quality-homes-g13": ("cupcake decorating", "Labour of Love"),
            "2026-09-24-foodland-h6": ("Start of Day Movement", "Definition Fitness"),
            "2026-09-24-foodland-h7": ("Fashion", "Pure Elegance"),
            "2026-09-24-foodland-h14": ("Wellness", "Hannah Grieg"),
            "2026-09-24-foodland-h16": ("Tobermory Hyperbaric Chamber", "George Harpur"),
            "2026-09-24-foodland-h18": ("Soul Purpose", "Ashley Grant"),
            "2026-09-24-foodland-h20": ("The Feeling of Home - Designing Beyond the Trend", "Home and Garden"),
            "2026-09-24-foodland-h25": ("Food and Drink", "Southampton Olive Oil"),
            "2026-09-24-foodland-h31": ("all things canning", "Greenock Collective"),
            "2026-09-24-harleys-i7": ("Christmas Urns", "Brenda Kreamer"),
            "2026-09-24-harleys-i16": ("Doterra w Jodi", None),
            "2026-09-24-quality-homes-j12": ("replanting house plants", "Guest House"),
            "2026-09-24-quality-homes-j14": ("sampling cold brew", "Guest House"),
            "2026-09-25-foodland-k6": ("Start of Day Movement", "Freezer Fitness"),
            "2026-09-25-foodland-k7": ("Food and Drink", "Fire Cider & Honey"),
            "2026-09-25-foodland-k11": ("Hormones and Food", "Jennifer Dunsmoor"),
            "2026-09-25-foodland-k14": ("Fashion", "Forrest Maiden"),
            "2026-09-25-foodland-k16": ("Shop by Grace", "Modern women’s fashion boutique in downtown Walkerton, offering trendy, yet timeless clothing, denim, footwear, jewelry and lifestyle pieces."),
            "2026-09-25-foodland-k21": ("Wellness", "Freezer Fitness\nJackie West, Dianne Zettle, Conor Fischer"),
            "2026-09-25-foodland-k31": ("Home and Garden", "Carrie Lynn Floral"),
            "2026-09-25-foodland-k33": ("Angela - Up stage Design", None),
            "2026-09-25-harleys-l22": ("Organic Facial", "Sara Porter\nRemind Wellness"),
            "2026-09-25-quality-homes-m10": ("All things honey -Jody", None),
            "2026-09-25-quality-homes-m15": ("The perfect Christmas Trees", "Flowers by Uss"),
        }
        self.assertEqual(46, len(expected))
        for identity, content in expected.items():
            row = events[identity]
            self.assertEqual(content, (row["title"], row["description"]), identity)

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
