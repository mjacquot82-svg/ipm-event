-- Additive, staging-deployed foundation for device-specific itinerary reminders.
-- Service-role backend access only: RLS is enabled and no browser-facing policy exists.

create table if not exists public.itinerary_reminder_installations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  wonderpush_installation_id text not null,
  capability_hash text not null check (length(capability_hash) = 64),
  reminders_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text,
  unique (event_id, wonderpush_installation_id)
);

create table if not exists public.itinerary_reminder_stars (
  registration_id uuid not null references public.itinerary_reminder_installations(id) on delete cascade,
  schedule_item_id uuid not null references public.schedule_items(id) on delete cascade,
  starred_at timestamptz not null default now(),
  primary key (registration_id, schedule_item_id)
);

create table if not exists public.itinerary_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.itinerary_reminder_installations(id) on delete cascade,
  schedule_item_id uuid not null references public.schedule_items(id) on delete cascade,
  reminder_type text not null check (reminder_type = 'itinerary_t30'),
  status text not null check (status in ('claimed', 'sent', 'failed')),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_delivery_id text,
  error_message text,
  unique (registration_id, schedule_item_id, reminder_type)
);

alter table public.itinerary_reminder_installations enable row level security;
alter table public.itinerary_reminder_stars enable row level security;
alter table public.itinerary_reminder_deliveries enable row level security;

create index if not exists itinerary_reminder_stars_schedule_idx
  on public.itinerary_reminder_stars (schedule_item_id, starred_at);
create index if not exists itinerary_reminder_installations_enabled_idx
  on public.itinerary_reminder_installations (event_id, reminders_enabled) where reminders_enabled;

drop trigger if exists set_itinerary_reminder_installations_updated_at on public.itinerary_reminder_installations;
create trigger set_itinerary_reminder_installations_updated_at before update
  on public.itinerary_reminder_installations for each row execute function public.set_updated_at();

create or replace function public.sync_itinerary_reminder_stars(
  p_registration_id uuid, p_schedule_item_ids uuid[]
) returns table(starred_count bigint) language plpgsql security definer set search_path = public as $$
declare registration_event_id uuid;
begin
  select event_id into registration_event_id from itinerary_reminder_installations
    where id = p_registration_id for update;
  if registration_event_id is null then raise exception 'Unknown reminder registration'; end if;
  if exists (
    select 1 from unnest(p_schedule_item_ids) supplied(id)
    left join schedule_items item on item.id = supplied.id
      and item.event_id = registration_event_id and item.status <> 'archived'
    where item.id is null
  ) then raise exception 'Unknown or cross-event Schedule UUID'; end if;
  delete from itinerary_reminder_stars where registration_id = p_registration_id
    and not (schedule_item_id = any(p_schedule_item_ids));
  insert into itinerary_reminder_stars(registration_id, schedule_item_id)
    select p_registration_id, id from unnest(p_schedule_item_ids) supplied(id)
    on conflict do nothing;
  update itinerary_reminder_installations set last_sync_at = now(), last_error = null
    where id = p_registration_id;
  return query select count(*) from itinerary_reminder_stars where registration_id = p_registration_id;
end;
$$;
revoke all on function public.sync_itinerary_reminder_stars(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.sync_itinerary_reminder_stars(uuid, uuid[]) to service_role;

create or replace function public.claim_due_itinerary_reminders(p_now timestamptz)
returns table(delivery_id uuid, registration_id uuid, schedule_item_id uuid,
  wonderpush_installation_id text, title text, location_name text, starts_at timestamptz)
language sql security definer set search_path = public as $$
  with eligible as (
    select registration.id registration_id, star.schedule_item_id,
      registration.wonderpush_installation_id, item.title, item.location_name, item.starts_at
    from itinerary_reminder_installations registration
    join itinerary_reminder_stars star on star.registration_id = registration.id
    join schedule_items item on item.id = star.schedule_item_id
      and item.event_id = registration.event_id
    where registration.reminders_enabled
      and item.status = 'published'
      and item.starts_at > p_now + interval '25 minutes'
      and item.starts_at <= p_now + interval '30 minutes'
      and star.starred_at <= item.starts_at - interval '30 minutes'
  ), claimed as (
    insert into itinerary_reminder_deliveries(registration_id, schedule_item_id, reminder_type, status)
      select registration_id, schedule_item_id, 'itinerary_t30', 'claimed' from eligible
      on conflict (registration_id, schedule_item_id, reminder_type) do nothing
      returning id, registration_id, schedule_item_id
  )
  select claimed.id, eligible.registration_id, eligible.schedule_item_id,
    eligible.wonderpush_installation_id, eligible.title, eligible.location_name, eligible.starts_at
  from claimed join eligible using (registration_id, schedule_item_id);
$$;
revoke all on function public.claim_due_itinerary_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_due_itinerary_reminders(timestamptz) to service_role;

-- Rollback (staging only): drop both functions, then deliveries, stars, and installations in that order.
