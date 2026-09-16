import copy
from datetime import datetime
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('dirtworks', Path(__file__).parents[1] / 'backend/prepare_dirtworks_schedule.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class DirtworksTests(unittest.TestCase):
    def test_official_dates_times_and_media(self):
        rows = m.desired_rows()
        self.assertEqual(len(rows), 5)
        self.assertEqual(len({r['external_id'] for r in rows}), 5)
        for index, row in enumerate(rows):
            start, end = map(datetime.fromisoformat, (row['starts_at'], row['ends_at']))
            self.assertEqual(start.day, 22 + index)
            self.assertEqual(start.hour, 14 if index < 3 else 12)
            self.assertEqual(start.minute, 0)
            self.assertEqual((end-start).total_seconds(), 3600)
            self.assertEqual(start.utcoffset().total_seconds(), -14400)
            self.assertEqual(row['category'], 'DirtWorks Demo Field')
            self.assertEqual(row['location_name'], 'DirtWorks Demo Field')
            self.assertIsNone(row['latitude'])
            self.assertIsNone(row['longitude'])
            self.assertIn('Dealer Demo', row['description'])
        self.assertEqual([r['title'] for r in rows], ['Mini Ex Rodeo', 'Track Loader Rodeo', 'Mini Ex Rodeo', 'Track Loader Rodeo', 'Compact Ride & Drive'])

    def test_idempotent_and_preserves_unrelated(self):
        unrelated = {'id': 'ram', 'event_id': m.EVENT_ID, 'title': 'RAM Rodeo'}
        before = [unrelated]
        saved = copy.deepcopy(before)
        first = m.plan(before)
        self.assertEqual(len(first['insert']), 5)
        second = m.plan(before + first['insert'])
        self.assertEqual(second['insert'], [])
        self.assertEqual(len(second['unchanged']), 5)
        self.assertEqual(before, saved)

    def test_near_match_and_duplicate_block_creation(self):
        for title in ['Mini Excavator Rodeo', 'Dirt Works', 'Track Loader Rodeo', 'Dealer Demo', 'Ride & Drive Compact Tractors']:
            with self.assertRaises(ValueError):
                m.plan([{'event_id': m.EVENT_ID, 'title': title}])
        rows = m.desired_rows()
        with self.assertRaises(ValueError):
            m.plan(rows + [rows[0]])
        rows[0]['starts_at'] = '2026-09-22T13:00:00-04:00'
        with self.assertRaises(ValueError):
            m.plan(rows)

    def test_preview_preserves_every_existing_record(self):
        before = {'events': [{'id': 'unrelated', 'description': 'unchanged'}], 'total_count': 1}
        after = m.schedule_preview(before, m.desired_rows())
        self.assertEqual(after['events'][:1], before['events'])
        self.assertEqual(after['total_count'], 6)
        self.assertEqual(m.schedule_preview(after, m.desired_rows()), after)


if __name__ == '__main__':
    unittest.main()
