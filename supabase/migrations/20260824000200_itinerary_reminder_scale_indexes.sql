-- Additive staging indexes for bounded T-30 claim and backlog queries.
create index if not exists itinerary_reminder_stars_registration_schedule_idx
  on public.itinerary_reminder_stars(registration_id, schedule_item_id, starred_at);
create index if not exists itinerary_reminder_installations_due_idx
  on public.itinerary_reminder_installations(event_id, reminders_enabled, provider_deliverable, provider_checked_at)
  where reminders_enabled and provider_deliverable;
create index if not exists itinerary_reminder_deliveries_backlog_idx
  on public.itinerary_reminder_deliveries(status, next_attempt_at, claimed_at);
create index if not exists itinerary_reminder_synthetic_stars_event_registration_idx
  on public.itinerary_reminder_synthetic_stars(synthetic_event_id, registration_id, starred_at);
create index if not exists itinerary_reminder_synthetic_deliveries_backlog_idx
  on public.itinerary_reminder_synthetic_deliveries(status, next_attempt_at, claimed_at);
create index if not exists itinerary_reminder_synthetic_events_due_idx
  on public.itinerary_reminder_synthetic_events(event_id, status, starts_at);

-- Rollback: drop the six *_idx indexes above. No data rows are changed.
