-- Additive notification analytics metadata. Existing historical rows remain NULL/unknown.
alter table public.notification_deliveries
  add column if not exists provider_delivery_id text,
  add column if not exists provider_requested_at timestamptz,
  add column if not exists provider_accepted_at timestamptz,
  add column if not exists provider_targeted_device_count integer,
  add column if not exists provider_sent_count integer,
  add column if not exists provider_confirmed_receipt_count integer,
  add column if not exists provider_failure_count integer,
  add column if not exists provider_open_count integer,
  add column if not exists provider_unique_open_count integer,
  add column if not exists provider_statistics_refreshed_at timestamptz,
  add column if not exists provider_statistics_status text,
  add column if not exists provider_statistics_error text,
  add column if not exists notification_origin_visit_count integer;

comment on column public.notification_deliveries.provider_campaign_id is
  'Stable IPM-assigned WonderPush campaign identity for future sends; NULL for historical sends.';
comment on column public.notification_deliveries.provider_delivery_id is
  'Provider delivery/request reference when returned; never interpreted as device delivery.';
comment on column public.notification_deliveries.provider_confirmed_receipt_count is
  'Provider-confirmed receipts, not guaranteed OS-visible display.';
comment on column public.notification_deliveries.provider_targeted_device_count is
  'Provider-reported targeted installations; NULL when unavailable.';
