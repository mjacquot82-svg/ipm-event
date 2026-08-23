-- Additive staging-only readiness and honest provider-outcome semantics (after the controlled-test tables).
alter table public.itinerary_reminder_installations
  add column if not exists provider_reachability text not null default 'unknown'
    check (provider_reachability in ('unknown', 'optIn', 'softOptOut', 'optOut')),
  add column if not exists provider_has_push_token boolean not null default false,
  add column if not exists provider_deliverable boolean not null default false,
  add column if not exists provider_checked_at timestamptz;

alter table public.itinerary_reminder_installations
  add constraint itinerary_reminder_installations_event_capability_key
  unique (event_id, capability_hash);

alter table public.itinerary_reminder_deliveries
  drop constraint if exists itinerary_reminder_deliveries_status_check;
alter table public.itinerary_reminder_deliveries
  add constraint itinerary_reminder_deliveries_status_check
  check (status in ('claimed', 'provider_accepted', 'provider_failed', 'delivery_unknown', 'confirmed_delivered', 'sent', 'failed'));

alter table public.controlled_targeting_tests
  drop constraint if exists controlled_targeting_tests_status_check;
alter table public.controlled_targeting_tests
  add column if not exists provider_accepted_at timestamptz,
  add constraint controlled_targeting_tests_status_check
  check (status in ('claimed', 'provider_accepted', 'provider_failed', 'delivery_unknown', 'sent', 'failed'));

update public.controlled_targeting_tests
set status = 'provider_accepted', provider_accepted_at = coalesce(provider_accepted_at, sent_at)
where status = 'sent';

create or replace function public.claim_due_itinerary_reminders(p_now timestamptz)
returns table(delivery_id uuid, registration_id uuid, schedule_item_id uuid,
  wonderpush_installation_id text, title text, location_name text, starts_at timestamptz)
language sql security definer set search_path = public as $$
  with eligible as (
    select registration.id registration_id, star.schedule_item_id,
      registration.wonderpush_installation_id, item.title, item.location_name, item.starts_at
    from itinerary_reminder_installations registration
    join itinerary_reminder_stars star on star.registration_id = registration.id
    join schedule_items item on item.id = star.schedule_item_id and item.event_id = registration.event_id
    where registration.reminders_enabled
      and registration.provider_deliverable
      and registration.provider_reachability = 'optIn'
      and registration.provider_has_push_token
      and registration.provider_checked_at > p_now - interval '15 minutes'
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

-- Rollback: restore the prior claim function, map new statuses back to sent/failed,
-- then drop the new columns. No Schedule or favorite rows are changed by this migration.
