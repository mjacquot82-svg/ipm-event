-- Preserve historical Webpushr rows while allowing the staged WonderPush cutover.
-- Callers must always choose a provider explicitly; there is no provider default.

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_provider_check;

alter table public.notification_deliveries
  alter column provider drop default;

alter table public.notification_deliveries
  add constraint notification_deliveries_provider_check
  check (provider in ('webpushr', 'wonderpush'));
