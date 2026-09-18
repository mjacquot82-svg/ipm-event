-- Permit separately authorized one-shot test conditions while preserving deduplication per condition.
alter table public.controlled_targeting_tests add column if not exists test_key text;
update public.controlled_targeting_tests set test_key = 'initial' where test_key is null;
alter table public.controlled_targeting_tests alter column test_key set not null;
alter table public.controlled_targeting_tests drop constraint if exists controlled_targeting_tests_event_id_key;
alter table public.controlled_targeting_tests add constraint controlled_targeting_tests_event_test_key
  unique (event_id, test_key);
-- Rollback requires deleting non-initial test rows, restoring unique(event_id), then dropping test_key.
