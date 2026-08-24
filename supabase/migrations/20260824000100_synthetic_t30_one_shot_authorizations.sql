-- Additive staging test authorization. It can reference synthetic fixtures only.
create table if not exists public.itinerary_reminder_synthetic_authorizations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  synthetic_event_id uuid not null references public.itinerary_reminder_synthetic_events(id) on delete cascade,
  registration_id uuid not null references public.itinerary_reminder_installations(id) on delete cascade,
  reminder_type text not null default 'itinerary_t30' check (reminder_type = 'itinerary_t30'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  authorized_by text not null,
  constraint synthetic_authorization_expiry check (expires_at > created_at and expires_at <= created_at + interval '15 minutes'),
  unique(synthetic_event_id, reminder_type)
);
alter table public.itinerary_reminder_synthetic_authorizations enable row level security;

create or replace function public.claim_authorized_synthetic_itinerary_reminder(
  p_now timestamptz, p_event_id uuid, p_synthetic_event_id uuid, p_registration_id uuid
) returns table(delivery_id uuid, authorization_id uuid, registration_id uuid, synthetic_event_id uuid,
  wonderpush_installation_id text, title text, location_name text, starts_at timestamptz)
language sql security definer set search_path=public as $$
  with eligible as (
    select authz.id authorization_id, registration.id registration_id,
      item.id synthetic_event_id, registration.wonderpush_installation_id,
      item.title, item.location_name, item.starts_at
    from itinerary_reminder_synthetic_authorizations authz
    join itinerary_reminder_installations registration
      on registration.id=authz.registration_id and registration.event_id=authz.event_id
    join itinerary_reminder_synthetic_events item
      on item.id=authz.synthetic_event_id and item.event_id=authz.event_id
    join itinerary_reminder_synthetic_stars star
      on star.registration_id=registration.id and star.synthetic_event_id=item.id
    where authz.event_id=p_event_id
      and authz.synthetic_event_id=p_synthetic_event_id
      and authz.registration_id=p_registration_id
      and authz.reminder_type='itinerary_t30'
      and authz.consumed_at is null and authz.expires_at>p_now
      and registration.test_device_label='A' and registration.reminders_enabled
      and registration.provider_deliverable and registration.provider_reachability='optIn'
      and registration.provider_has_push_token
      and registration.provider_checked_at>p_now-interval '15 minutes'
      and item.status='published'
      and item.starts_at>p_now+interval '25 minutes'
      and item.starts_at<=p_now+interval '30 minutes'
      and star.starred_at<item.starts_at-interval '30 minutes'
      and not exists(select 1 from itinerary_reminder_synthetic_deliveries delivery
        where delivery.registration_id=registration.id and delivery.synthetic_event_id=item.id
          and delivery.reminder_type='itinerary_t30')
  ), consumed as (
    update itinerary_reminder_synthetic_authorizations authz
      set consumed_at=p_now
    from eligible
    where authz.id=eligible.authorization_id and authz.consumed_at is null
      and authz.expires_at>p_now
    returning authz.id
  ), claimed as (
    insert into itinerary_reminder_synthetic_deliveries(
      registration_id,synthetic_event_id,reminder_type,status,attempt_count,updated_at)
    select eligible.registration_id,eligible.synthetic_event_id,'itinerary_t30','claimed',1,p_now
    from eligible join consumed on consumed.id=eligible.authorization_id
    on conflict (registration_id,synthetic_event_id,reminder_type) do nothing
    returning id,registration_id,synthetic_event_id
  )
  select claimed.id,eligible.authorization_id,eligible.registration_id,eligible.synthetic_event_id,
    eligible.wonderpush_installation_id,eligible.title,eligible.location_name,eligible.starts_at
  from claimed join eligible using(registration_id,synthetic_event_id);
$$;

revoke all on table public.itinerary_reminder_synthetic_authorizations from public,anon,authenticated;
revoke all on function public.claim_authorized_synthetic_itinerary_reminder(timestamptz,uuid,uuid,uuid)
  from public,anon,authenticated;
grant all on table public.itinerary_reminder_synthetic_authorizations to service_role;
grant execute on function public.claim_authorized_synthetic_itinerary_reminder(timestamptz,uuid,uuid,uuid)
  to service_role;

-- Rollback: drop claim_authorized_synthetic_itinerary_reminder and
-- itinerary_reminder_synthetic_authorizations. No Schedule row is read or changed by rollback.
