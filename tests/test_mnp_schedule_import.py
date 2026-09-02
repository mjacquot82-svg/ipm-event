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
            "2026-09-22-foodland-b9": ('Davishill Nursery', "10:45 AM", "11:15 AM", 'A local garden centre and nursery near Walkerton owned and operated by Jeff Davis.'),
            "2026-09-22-foodland-b11": ('Sleepers Bed Gallery (Sadie Al)', "11:15 AM", "11:45 AM", 'For 30 years Sleepers Bed Gallery has been Kincardine Ontario’s trusted local sleep experts helping our community find the right sleep solutions through personalized service, expert knowledge, and genuine passion for better sleep.'),
            "2026-09-22-foodland-b25": ('West Shore Clothing and Surf Shop', "2:45 PM", "3:15 PM", 'Family-owned independent boutique in downtown Kincardine. Dressing makeover contestant.'),
            "2026-09-23-foodland-e32": ('Mary Kay (Cheryl McNair)', "4:30 PM", "5:00 PM", 'Independent beauty consultant providing personalized beauty and skin care guidance.'),
            "2026-09-24-foodland-h11": ("Elgin Jewelers", "11:15 AM", "11:45 AM", 'Family-owned jewelry store serving the communities since 1977, with a strong focus on quality craftsmanship and personalized service.'),
            "2026-09-25-foodland-k18": ("His Style", "1:00 PM", "1:30 PM", 'Locally owned men’s clothing boutique in downtown Walkerton, offering quality clothing for casual, business casual, and formal occasions.'),
        }
        for identity, values in expected.items():
            row = events[identity]
            self.assertEqual(values, (row["title"], row["start_time"], row["end_time"], row["description"]))
        self.assertEqual("4:00 PM", events["2026-09-22-quality-homes-d30"]["start_time"])
        saturday = sorted(
            [row for row in events.values() if row["date"] == "2026-09-26"],
            key=lambda row: row["start_time"],
        )
        self.assertEqual(2, len(saturday))
        self.assertTrue(all(row["title"] == "GINA LIVY" and row["location_name"] == "The Beyond Wireless Stage" for row in saturday))
        self.assertEqual(("10:00 AM", "11:00 AM", "Doors open 9:00 AM"), (saturday[0]["start_time"], saturday[0]["end_time"], saturday[0]["description"]))
        self.assertEqual(("1:30 PM", "2:30 PM", "Doors open 12:30 PM"), (saturday[1]["start_time"], saturday[1]["end_time"], saturday[1]["description"]))

    def test_multiline_workbook_content_is_preserved_exactly(self):
        events = {row["external_id"]: row for row in load_manifest()["events"]}
        expected = {
            "2026-09-22-foodland-b6": ("Christie Thomson — Definition Fitness", 'Christie will be kicking off our morning movement Tuesday and Thursday mornings. Please come bring a friend, enjoy a free coffee and get that body moving and warmed up for the day at The IPM!'),
            "2026-09-22-foodland-b7": ('Aaniin Collective (Hannah Wheeler)', 'If you feel overwhelmed by the noise in the world on how to properly raise your child the Aaniin Collective will guide you on the journey to confident parenting.'),
            "2026-09-22-foodland-b14": ("Food and Drink", "Greenock Collective"),
            "2026-09-22-foodland-b18": ("Meat smoking", "Liesemer Home Hardware"),
            "2026-09-22-foodland-b21": ("Photography Bietz Studio", "Fashion"),
            "2026-09-22-foodland-b23": ('Hayley Wilhelm MUA', 'Local makeup artist. Providing makeover contest with makeup.'),
            "2026-09-22-foodland-b28": ("Wellness", "The Space Between\nAlicia Gibbons"),
            "2026-09-22-foodland-b30": ("Nature Babes", "Amanda Butchart"),
            "2026-09-22-foodland-b32": ("Jessica Connor & Rebecca Grubb — The WOMB Bruce County", 'Jessica Connor — The WOMB Bruce County\nCo-Owner of The WOMB Bruce County and full spectrum doula. She is a Fertility, Birth, and Postpartum Doula, Holistic Reproductive Practitioner, and Fertility Coach.\n\nRebecca Grubb — The WOMB Bruce County\nRebecca is a Registered Pelvic Health Physiotherapist and a Perinatal Health Advocate.'),
            "2026-09-22-harleys-c7": ("DK Salon", "DK Salon is a locally owned hair salon, operated by Jenna Freiburger, offering professional hairstyling in a welcoming, personalized setting."),
            "2026-09-22-harleys-c19": ("Charcuterie Sampling Harley's", None),
            "2026-09-22-quality-homes-d18": ('Hayley Wilhelm MUA', 'Local makeup artist. Providing makeover contest with makeup.'),
            "2026-09-22-quality-homes-d22": ("Chelsea Spackman — All Bodies Studios", 'Chelsea is the founder and Lead Instructor of All Bodies Studios—a growing, community-focused Pilates brand built on the belief that every body deserves to move with confidence, feel strong, and belong in the room.'),
            "2026-09-22-quality-homes-d30": ("Shroom Soda", "West Shore"),
            "2026-09-22-quality-homes-d7": ("Bombshell", "Locally owned hair and beauty salon downtown Walkerton, offering hair and nail services."),
            "2026-09-23-foodland-e7": ("Liza Weltz — Essential Wellness", 'Liza is a registered Reflexologist and will be speaking on the benefits of holistic healing and putting your health and wellness into your own hands.'),
            "2026-09-23-foodland-e9": ("Rachel Stroeder — Evergreen Connections", 'Personalized Support for Your Family’s Needs at Every Stage'),
            "2026-09-23-foodland-e12": ("Susan Seitz — Susan Seitz Studio | Creative Circle", 'Susan is an artist, Certified Master Creativity Coach and passionate arts facilitator who shares the powerful role creativity can play in our well-being with stories from her work and a hands-on experience for everyone to enjoy.'),
            "2026-09-23-foodland-e14": ('The Maven Project — Ruth Montgomery', 'Ruth is a personal development coach who teaches through the lens of spiritual development. A professional interior designer and expert in energy within the home, she explores the powerful connection between our spaces, our energy, and how we feel. She is a collector of experiences, an avid learner, and a natural connector. Ruth is based out of Lucknow, ON.'),
            "2026-09-23-foodland-e21": ('Heather Stark, Willow Home', 'Heather is the creative hands behind Willow Home, a furniture refinisher based in Walkerton, Ontario. With a love for seeing the beauty and potential in pieces others may overlook, she gives furniture a second chance through thoughtful refinishing and restoration. Heather believes a home is made more meaningful by pieces with a story—and sometimes, the best pieces are the ones given new life.'),
            "2026-09-23-foodland-e28": ('J and H Womens’ Fashions', 'Locally loved women’s clothing boutique, offering stylish, versatile fashions for women of all ages and sizes.'),
            "2026-09-23-foodland-e30": ('Flossie Mae Custom Hats', "“Lets create TOGETHER. Your own UNIQUE hat, choose a color/finish/style. Create a MEMORY. Tell your STORY, and hold it close. Then wear it PROUDLY.”"),
            "2026-09-23-harleys-f10": ('Mary Kay (Cheryl McNair)', 'Independent beauty consultant providing personalized beauty and skin care guidance.'),
            "2026-09-23-harleys-f16": ('Flossie Mae Custom Hats', "“Lets create TOGETHER. Your own UNIQUE hat, choose a color/finish/style. Create a MEMORY. Tell your STORY, and hold it close. Then wear it PROUDLY.”"),
            "2026-09-23-harleys-f7": ("Wood Working", "Mark Grubb"),
            "2026-09-23-harleys-f21": ("Simply Potts", "by Lauriss"),
            "2026-09-23-quality-homes-g13": ("Cupcake decorating", "Labour of Love"),
            "2026-09-23-quality-homes-g22": ("Bombshell", "Locally owned hair and beauty salon downtown Walkerton, offering hair and nail services."),
            "2026-09-24-foodland-h6": ("Christie Thomson — Definition Fitness", 'Christie will be kicking off our morning movement Tuesday and Thursday mornings. Please come bring a friend, enjoy a free coffee and get that body moving and warmed up for the day at The IPM!'),
            "2026-09-24-foodland-h7": ('Pure Elegance Bridal', 'Bridal and formal wear boutique, specializing in beautiful, timeless styles for life’s special occasions.'),
            "2026-09-24-foodland-h9": ("His Style", "Locally owned men’s clothing boutique in downtown Walkerton, offering quality clothing for casual, business casual, and formal occasions."),
            "2026-09-24-foodland-h14": ("Hannah Greig — Naturally Well by Hannah", 'Perimenopause is a natural transition, not something to fear. Join Registered Nutritional Therapist Hannah Greig to understand the changes your body is designed to experience, why symptoms can arise, and how to support yourself through these years with greater ease, confidence and grace.'),
            "2026-09-24-foodland-h16": ("Tobermory Hyperbaric Chamber", "George Harpur"),
            "2026-09-24-foodland-h18": ("Ashley Grant — Soul Purpose Reiki", 'Ashley is a Reiki Master and Teacher, Meditation Coach, Breathwork Specialist, ALL Game Guide and International Retreat Leader & Speaker who will be speaking and sharing how reiki and other modalities can help you release what is no longer serving, start living in your soul’s purpose and build a life that with catch you!'),
            "2026-09-24-foodland-h20": ("The Feeling of Home - Designing Beyond the Trend", "Home and Garden"),
            "2026-09-24-foodland-h25": ("Food and Drink", "Southampton Olive Oil"),
            "2026-09-24-foodland-h31": ("All things canning", "Greenock Collective"),
            "2026-09-24-harleys-i7": ("Christmas Urns", "Brenda Kreamer"),
            "2026-09-24-harleys-i24": ('Mary Kay (Cheryl McNair)', 'Independent beauty consultant providing personalized beauty and skin care guidance.'),
            "2026-09-24-harleys-i16": ("Doterra w Jodi", None),
            "2026-09-24-quality-homes-j12": ("Replanting house plants", "Guest House"),
            "2026-09-24-quality-homes-j14": ("Sampling cold brew", "Guest House"),
            "2026-09-24-quality-homes-j7": ("Bombshell", "Locally owned hair and beauty salon downtown Walkerton, offering hair and nail services."),
            "2026-09-25-foodland-k6": ("Start of Day Movement", "Freezer Fitness"),
            "2026-09-25-foodland-k7": ("Food and Drink", "Fire Cider & Honey"),
            "2026-09-25-foodland-k11": ("Hormones and Food", "Jennifer Dunsmoor"),
            "2026-09-25-foodland-k14": ('Forest Maiden Facial and Beauty Room', 'Offering goddess inspired facials, facial waxing, and makeup artistry. A natural, feminine, peaceful, beauty studio with a strong connection to nature.'),
            "2026-09-25-foodland-k16": ('By Grace Boutique', "Modern women’s fashion boutique in downtown Walkerton, offering trendy, yet timeless clothing, denim, footwear, jewelry and lifestyle pieces."),
            "2026-09-25-foodland-k21": ("Beth Fischer — Freezer Fitness", 'Movement is Medicine - together with the Freezer Fitness team, exploring the opportunity for every age, body and ability to confidently move and recover.'),
            "2026-09-25-foodland-k31": ("Home and Garden", "Carrie Lynn Floral"),
            "2026-09-25-foodland-k33": ("Angela - Up stage Design", None),
            "2026-09-25-harleys-l22": ("Sara Porter — Re:mind Wellness Spa & Apothecary", 'Sara will demonstrate three unique Eminence Organic facials and explore why choosing organic skincare is more than a passing trend—it’s a thoughtful, results-driven approach to caring for your skin and the planet.'),
            "2026-09-25-quality-homes-m10": ("All things honey -Jody", None),
            "2026-09-25-quality-homes-m15": ("The perfect Christmas Trees", "Flowers by Uss"),
            "2026-09-25-quality-homes-m23": ('Forest Maiden Facial and Beauty Room', 'Offering goddess inspired facials, facial waxing, and makeup artistry. A natural, feminine, peaceful, beauty studio with a strong connection to nature.'),
        }
        self.assertEqual(55, len(expected))
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
