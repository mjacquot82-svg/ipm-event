-- Staging-only temporary labels for the controlled two-device targeting proof.
alter table public.itinerary_reminder_installations
  add column if not exists test_device_label text check (test_device_label in ('A', 'B'));
create unique index if not exists itinerary_reminder_test_device_label_idx
  on public.itinerary_reminder_installations(event_id, test_device_label)
  where test_device_label is not null;
-- Rollback: drop the index, then drop test_device_label.
