-- Aggregate-only notification analytics and immutable send-time readiness snapshots.
alter table public.notification_deliveries
  add column if not exists audience_device_count integer
    check (audience_device_count is null or audience_device_count >= 0),
  add column if not exists audience_count_basis text
    check (audience_count_basis is null or audience_count_basis = 'verified_deliverable_registrations'),
  add column if not exists audience_snapshot_at timestamptz,
  add column if not exists audience_stale_device_count integer
    check (audience_stale_device_count is null or audience_stale_device_count >= 0);

comment on column public.notification_deliveries.audience_device_count is
  'Immutable count of registered devices mirrored as provider-deliverable when the send was requested; null for historical rows.';
comment on column public.notification_deliveries.audience_count_basis is
  'Controlled semantic identifier for audience_device_count; never a provider installation identifier.';
comment on column public.notification_deliveries.audience_snapshot_at is
  'Timestamp when the immutable readiness-mirror audience count was computed.';
comment on column public.notification_deliveries.audience_stale_device_count is
  'Subset of audience_device_count whose provider readiness check was older than 24 hours at snapshot time.';
