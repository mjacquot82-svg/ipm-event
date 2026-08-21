-- Staging-only, idempotent fixtures. Never apply this seed to production.
-- Fixed UUIDs make the announcement deep link stable across resets.

insert into public.events (
  id, slug, name, description, timezone, status, starts_at, ends_at
) values (
  '51000000-0000-4000-8000-000000000001',
  'ipm-staging',
  'IPM Staging',
  'Isolated non-production staging event for IPM integration testing only.',
  'America/Toronto',
  'active',
  '2027-09-14 12:00:00-04',
  '2027-09-18 23:00:00-04'
)
on conflict (id) do update set
  slug = excluded.slug, name = excluded.name, description = excluded.description,
  timezone = excluded.timezone, status = excluded.status,
  starts_at = excluded.starts_at, ends_at = excluded.ends_at;

insert into public.alerts (
  id, event_id, title, message, severity, audience, status,
  published_at, expires_at, created_by
) values (
  '51000000-0000-4000-8000-000000000002',
  '51000000-0000-4000-8000-000000000001',
  '[STAGING] WonderPush Test',
  'Non-production notification and announcement deep-link test for the isolated IPM staging environment.',
  'info', 'all', 'published',
  '2026-08-21 12:00:00+00', '2030-12-31 23:59:59+00',
  'Staging setup'
)
on conflict (id) do update set
  event_id = excluded.event_id, title = excluded.title, message = excluded.message,
  severity = excluded.severity, audience = excluded.audience, status = excluded.status,
  published_at = excluded.published_at, expires_at = excluded.expires_at,
  created_by = excluded.created_by;

insert into public.schedule_items (
  id, event_id, title, description, starts_at, ends_at, timezone,
  category, location_name, days_active, source, external_id, status, sort_order
) values (
  '51000000-0000-4000-8000-000000000003',
  '51000000-0000-4000-8000-000000000001',
  '[STAGING] Test Session',
  'Non-production schedule fixture for staging navigation tests.',
  '2027-09-15 10:00:00-04', '2027-09-15 11:00:00-04',
  'America/Toronto', 'Event', 'Staging Test Hall', 'Wednesday',
  'staging-seed', 'ipm-staging-schedule-1', 'published', 1
)
on conflict (id) do update set
  event_id = excluded.event_id, title = excluded.title, description = excluded.description,
  starts_at = excluded.starts_at, ends_at = excluded.ends_at, timezone = excluded.timezone,
  category = excluded.category, location_name = excluded.location_name,
  days_active = excluded.days_active, source = excluded.source,
  external_id = excluded.external_id, status = excluded.status, sort_order = excluded.sort_order;

insert into public.vendors (
  id, event_id, name, type, description, booth, location,
  hours_of_operation, days_of_operation, priority, source, external_id, status
) values (
  '51000000-0000-4000-8000-000000000004',
  '51000000-0000-4000-8000-000000000001',
  '[STAGING] Test Vendor', 'Testing',
  'Non-production vendor fixture for staging navigation tests.',
  'STAGE-01', 'Staging Test Hall', '10:00 AM - 4:00 PM', 'Wednesday',
  1, 'staging-seed', 'ipm-staging-vendor-1', 'published'
)
on conflict (id) do update set
  event_id = excluded.event_id, name = excluded.name, type = excluded.type,
  description = excluded.description, booth = excluded.booth, location = excluded.location,
  hours_of_operation = excluded.hours_of_operation, days_of_operation = excluded.days_of_operation,
  priority = excluded.priority, source = excluded.source,
  external_id = excluded.external_id, status = excluded.status;
