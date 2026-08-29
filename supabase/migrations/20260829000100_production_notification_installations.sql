-- Production-safe attendee WonderPush registrations. Service-role access only.
-- Registration never enables itinerary reminders.
create table if not exists public.notification_installations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  wonderpush_installation_id text not null,
  capability_hash text not null check (length(capability_hash) = 64),
  provider_reachability text not null default 'unknown',
  provider_has_push_token boolean not null default false,
  provider_deliverable boolean not null default false,
  provider_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, wonderpush_installation_id),
  unique (event_id, capability_hash)
);

alter table public.notification_installations enable row level security;

drop trigger if exists set_notification_installations_updated_at
  on public.notification_installations;
create or replace function public.set_notification_installations_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger set_notification_installations_updated_at before update
  on public.notification_installations for each row
  execute function public.set_notification_installations_updated_at();

revoke all on table public.notification_installations from public, anon, authenticated;
grant all on table public.notification_installations to service_role;

-- Rollback: drop table public.notification_installations; then drop function
-- public.set_notification_installations_updated_at();
