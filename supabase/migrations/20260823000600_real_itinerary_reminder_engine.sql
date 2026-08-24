-- Additive staging rollout for the real T-30 worker and isolated synthetic fixture.
alter table public.itinerary_reminder_deliveries
  add column if not exists provider_accepted_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
alter table public.itinerary_reminder_installations
  add column if not exists removed_star_count bigint not null default 0;

create table if not exists public.itinerary_reminder_synthetic_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  fixture_key text not null,
  title text not null,
  location_name text,
  starts_at timestamptz not null,
  status text not null default 'published' check (status in ('published', 'cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(event_id, fixture_key)
);
create table if not exists public.itinerary_reminder_synthetic_stars (
  registration_id uuid not null references public.itinerary_reminder_installations(id) on delete cascade,
  synthetic_event_id uuid not null references public.itinerary_reminder_synthetic_events(id) on delete cascade,
  starred_at timestamptz not null default now(),
  primary key(registration_id, synthetic_event_id)
);
create table if not exists public.itinerary_reminder_synthetic_deliveries (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.itinerary_reminder_installations(id) on delete cascade,
  synthetic_event_id uuid not null references public.itinerary_reminder_synthetic_events(id) on delete cascade,
  reminder_type text not null default 'itinerary_t30' check (reminder_type = 'itinerary_t30'),
  status text not null check (status in ('claimed','provider_accepted','provider_failed','delivery_unknown')),
  claimed_at timestamptz not null default now(), provider_accepted_at timestamptz,
  failed_at timestamptz, provider_delivery_id text, error_message text,
  attempt_count integer not null default 0, next_attempt_at timestamptz, updated_at timestamptz not null default now(),
  unique(registration_id, synthetic_event_id, reminder_type)
);
alter table public.itinerary_reminder_synthetic_events enable row level security;
alter table public.itinerary_reminder_synthetic_stars enable row level security;
alter table public.itinerary_reminder_synthetic_deliveries enable row level security;

create or replace function public.sync_itinerary_reminder_stars(
  p_registration_id uuid, p_schedule_item_ids uuid[]
) returns table(starred_count bigint) language plpgsql security definer set search_path=public as $$
declare registration_event_id uuid; removed_count bigint;
begin
  select event_id into registration_event_id from itinerary_reminder_installations
    where id=p_registration_id for update;
  if registration_event_id is null then raise exception 'Unknown reminder registration'; end if;
  if exists(select 1 from unnest(p_schedule_item_ids) supplied(id)
    left join schedule_items item on item.id=supplied.id and item.event_id=registration_event_id and item.status<>'archived'
    where item.id is null) then raise exception 'Unknown or cross-event Schedule UUID'; end if;
  delete from itinerary_reminder_stars where registration_id=p_registration_id
    and not(schedule_item_id=any(p_schedule_item_ids));
  get diagnostics removed_count = row_count;
  insert into itinerary_reminder_stars(registration_id,schedule_item_id)
    select p_registration_id,id from unnest(p_schedule_item_ids) supplied(id) on conflict do nothing;
  update itinerary_reminder_installations set last_sync_at=now(),last_error=null,
    removed_star_count=removed_star_count+removed_count where id=p_registration_id;
  return query select count(*) from itinerary_reminder_stars where registration_id=p_registration_id;
end; $$;

create or replace function public.list_due_itinerary_reminder_registrations(p_now timestamptz,p_event_id uuid,p_limit integer default 1000)
returns table(registration_id uuid, wonderpush_installation_id text)
language sql security definer set search_path=public as $$
  select distinct registration.id, registration.wonderpush_installation_id
  from itinerary_reminder_installations registration
  join itinerary_reminder_stars star on star.registration_id=registration.id
  join schedule_items item on item.id=star.schedule_item_id and item.event_id=registration.event_id
  where registration.event_id=p_event_id and registration.reminders_enabled and item.status='published'
    and item.starts_at > p_now + interval '25 minutes' and item.starts_at <= p_now + interval '30 minutes'
    and star.starred_at < item.starts_at - interval '30 minutes'
  limit greatest(1,least(p_limit,10000));
$$;

create or replace function public.list_due_synthetic_itinerary_reminder_registrations(p_now timestamptz,p_event_id uuid,p_limit integer default 1000)
returns table(registration_id uuid,wonderpush_installation_id text)
language sql security definer set search_path=public as $$
  select distinct registration.id,registration.wonderpush_installation_id
  from itinerary_reminder_installations registration
  join itinerary_reminder_synthetic_stars star on star.registration_id=registration.id
  join itinerary_reminder_synthetic_events item on item.id=star.synthetic_event_id and item.event_id=registration.event_id
  where registration.event_id=p_event_id and registration.reminders_enabled and item.status='published'
    and item.starts_at > p_now + interval '25 minutes' and item.starts_at <= p_now + interval '30 minutes'
    and star.starred_at < item.starts_at - interval '30 minutes'
  limit greatest(1,least(p_limit,10000));
$$;

create or replace function public.itinerary_reminder_operational_metrics(p_now timestamptz,p_event_id uuid)
returns table(registered_installations bigint,reminders_enabled bigint,provider_deliverable bigint,
  synchronized_stars bigint,eligible_reminders bigint,claimed_reminders bigint,provider_accepted bigint,
  provider_failed bigint,delivery_unknown bigint,suppressed_unstarred bigint,
  suppressed_late_starred bigint,suppressed_event_changed_or_unavailable bigint,
  suppressed_installation_unreachable bigint)
language sql security definer set search_path=public as $$
  select
    (select count(*) from itinerary_reminder_installations where event_id=p_event_id),
    (select count(*) from itinerary_reminder_installations where event_id=p_event_id and reminders_enabled),
    (select count(*) from itinerary_reminder_installations where event_id=p_event_id and provider_deliverable),
    (select count(*) from itinerary_reminder_stars s join itinerary_reminder_installations r on r.id=s.registration_id where r.event_id=p_event_id),
    (select count(*) from itinerary_reminder_installations r join itinerary_reminder_stars s on s.registration_id=r.id
      join schedule_items i on i.id=s.schedule_item_id and i.event_id=r.event_id
      where r.event_id=p_event_id and r.reminders_enabled and r.provider_deliverable and i.status='published'
        and i.starts_at>p_now+interval '25 minutes' and i.starts_at<=p_now+interval '30 minutes'
        and s.starred_at<i.starts_at-interval '30 minutes'),
    (select count(*) from itinerary_reminder_deliveries d join itinerary_reminder_installations r on r.id=d.registration_id where r.event_id=p_event_id and d.status='claimed'),
    (select count(*) from itinerary_reminder_deliveries d join itinerary_reminder_installations r on r.id=d.registration_id where r.event_id=p_event_id and d.status='provider_accepted'),
    (select count(*) from itinerary_reminder_deliveries d join itinerary_reminder_installations r on r.id=d.registration_id where r.event_id=p_event_id and d.status='provider_failed'),
    (select count(*) from itinerary_reminder_deliveries d join itinerary_reminder_installations r on r.id=d.registration_id where r.event_id=p_event_id and d.status='delivery_unknown'),
    (select coalesce(sum(removed_star_count),0) from itinerary_reminder_installations where event_id=p_event_id),
    (select count(*) from itinerary_reminder_stars s join itinerary_reminder_installations r on r.id=s.registration_id join schedule_items i on i.id=s.schedule_item_id
      where r.event_id=p_event_id and i.starts_at>p_now and s.starred_at>i.starts_at-interval '30 minutes'),
    (select count(*) from itinerary_reminder_stars s join itinerary_reminder_installations r on r.id=s.registration_id join schedule_items i on i.id=s.schedule_item_id
      where r.event_id=p_event_id and i.status<>'published'),
    (select count(*) from itinerary_reminder_installations where event_id=p_event_id and reminders_enabled and not provider_deliverable);
$$;

drop function if exists public.claim_due_itinerary_reminders(timestamptz);
create function public.claim_due_itinerary_reminders(p_now timestamptz,p_event_id uuid,p_limit integer default 250)
returns table(delivery_id uuid, registration_id uuid, schedule_item_id uuid,
  wonderpush_installation_id text, title text, location_name text, starts_at timestamptz)
language sql security definer set search_path = public as $$
  with eligible as (
    select registration.id registration_id, star.schedule_item_id,
      registration.wonderpush_installation_id, item.title, item.location_name, item.starts_at
    from itinerary_reminder_installations registration
    join itinerary_reminder_stars star on star.registration_id = registration.id
    join schedule_items item on item.id = star.schedule_item_id and item.event_id = registration.event_id
    where registration.event_id=p_event_id and registration.reminders_enabled and registration.provider_deliverable
      and registration.provider_reachability = 'optIn' and registration.provider_has_push_token
      and registration.provider_checked_at > p_now - interval '15 minutes'
      and item.status = 'published'
      and item.starts_at > p_now + interval '25 minutes'
      and item.starts_at <= p_now + interval '30 minutes'
      and star.starred_at < item.starts_at - interval '30 minutes'
    order by item.starts_at, registration.id limit greatest(1, least(p_limit, 1000))
  ), claimed as (
    insert into itinerary_reminder_deliveries(registration_id, schedule_item_id, reminder_type, status, attempt_count, updated_at)
      select registration_id, schedule_item_id, 'itinerary_t30', 'claimed', 1, p_now from eligible
      on conflict (registration_id, schedule_item_id, reminder_type) do update
        set status='claimed', claimed_at=p_now, attempt_count=itinerary_reminder_deliveries.attempt_count+1,
            updated_at=p_now, error_message=null
        where itinerary_reminder_deliveries.status='provider_failed'
          and itinerary_reminder_deliveries.attempt_count < 3
          and itinerary_reminder_deliveries.next_attempt_at <= p_now
      returning id, registration_id, schedule_item_id
  )
  select claimed.id, eligible.registration_id, eligible.schedule_item_id,
    eligible.wonderpush_installation_id, eligible.title, eligible.location_name, eligible.starts_at
  from claimed join eligible using (registration_id, schedule_item_id);
$$;

create or replace function public.claim_due_synthetic_itinerary_reminders(p_now timestamptz,p_event_id uuid,p_limit integer default 250)
returns table(delivery_id uuid, registration_id uuid, synthetic_event_id uuid,
  wonderpush_installation_id text, title text, location_name text, starts_at timestamptz)
language sql security definer set search_path = public as $$
  with eligible as (
    select registration.id registration_id, star.synthetic_event_id,
      registration.wonderpush_installation_id, item.title, item.location_name, item.starts_at
    from itinerary_reminder_installations registration
    join itinerary_reminder_synthetic_stars star on star.registration_id=registration.id
    join itinerary_reminder_synthetic_events item on item.id=star.synthetic_event_id and item.event_id=registration.event_id
    where registration.event_id=p_event_id and registration.reminders_enabled and registration.provider_deliverable
      and registration.provider_reachability='optIn' and registration.provider_has_push_token
      and registration.provider_checked_at > p_now - interval '15 minutes'
      and item.status='published' and item.starts_at > p_now + interval '25 minutes'
      and item.starts_at <= p_now + interval '30 minutes'
      and star.starred_at < item.starts_at - interval '30 minutes'
    order by item.starts_at, registration.id limit greatest(1, least(p_limit,1000))
  ), claimed as (
    insert into itinerary_reminder_synthetic_deliveries(registration_id,synthetic_event_id,reminder_type,status,attempt_count,updated_at)
      select registration_id,synthetic_event_id,'itinerary_t30','claimed',1,p_now from eligible
      on conflict (registration_id,synthetic_event_id,reminder_type) do update
        set status='claimed', claimed_at=p_now,
            attempt_count=itinerary_reminder_synthetic_deliveries.attempt_count+1,
            updated_at=p_now, error_message=null
        where itinerary_reminder_synthetic_deliveries.status='provider_failed'
          and itinerary_reminder_synthetic_deliveries.attempt_count < 3
          and itinerary_reminder_synthetic_deliveries.next_attempt_at <= p_now
      returning id,registration_id,synthetic_event_id
  )
  select claimed.id,eligible.registration_id,eligible.synthetic_event_id,
    eligible.wonderpush_installation_id,eligible.title,eligible.location_name,eligible.starts_at
  from claimed join eligible using(registration_id,synthetic_event_id);
$$;

revoke all on function public.claim_due_itinerary_reminders(timestamptz,uuid,integer) from public,anon,authenticated;
revoke all on function public.claim_due_synthetic_itinerary_reminders(timestamptz,uuid,integer) from public,anon,authenticated;
revoke all on function public.list_due_itinerary_reminder_registrations(timestamptz,uuid,integer) from public,anon,authenticated;
revoke all on function public.list_due_synthetic_itinerary_reminder_registrations(timestamptz,uuid,integer) from public,anon,authenticated;
revoke all on function public.itinerary_reminder_operational_metrics(timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.claim_due_itinerary_reminders(timestamptz,uuid,integer) to service_role;
grant execute on function public.claim_due_synthetic_itinerary_reminders(timestamptz,uuid,integer) to service_role;
grant execute on function public.list_due_itinerary_reminder_registrations(timestamptz,uuid,integer) to service_role;
grant execute on function public.list_due_synthetic_itinerary_reminder_registrations(timestamptz,uuid,integer) to service_role;
grant execute on function public.itinerary_reminder_operational_metrics(timestamptz,uuid) to service_role;

-- Rollback: drop the two synthetic claim/table paths and the added delivery columns;
-- restore the previous one-argument claim function. Schedule rows are never changed.
