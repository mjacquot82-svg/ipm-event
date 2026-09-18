import json
from pathlib import Path
import unittest
from backend.apply_daily_event_schedule_update import load_manifest, db_patch
class DailyEventScheduleTests(unittest.TestCase):
 def test_audited_counts_and_ids(self):
  m=load_manifest(); self.assertEqual(9,len(m['existing_updates'])); self.assertEqual(5,len(m['existing_exact_ids'])); self.assertEqual(8,len(m['additions']))
  self.assertEqual(14,len({x['id'] for x in m['existing_updates']}|set(m['existing_exact_ids'])))
 def test_existing_patches_never_change_ids(self):
  m=load_manifest()
  for row in m['existing_updates']:
   self.assertNotIn('id',db_patch(row)); self.assertNotIn('event_id',db_patch(row))
 def test_no_vendor_or_reminder_scope(self):
  text=Path('backend/apply_daily_event_schedule_update.py').read_text()
  self.assertNotIn('replace_schedule(',text)
  self.assertNotIn('vendor',text.lower())
  self.assertNotIn('reminder',text.lower())
 def test_required_updates(self):
  m=load_manifest(); by={r['id']:r for r in m['existing_updates']}
  self.assertEqual(('12:00 PM','12:45 PM'),(by['3428301c-510e-5ac3-a5e1-40d76191485d']['start_time'],by['3428301c-510e-5ac3-a5e1-40d76191485d']['end_time']))
  self.assertEqual('1:30 PM',by['cdb0efc4-577f-5e6e-87e3-f03d8ebe2c9a']['start_time'])
if __name__=='__main__': unittest.main()
