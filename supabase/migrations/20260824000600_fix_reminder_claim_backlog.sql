-- Ensure later claim cycles advance past already-ledgered reminders instead of reselecting them.
create or replace function public.claim_due_itinerary_reminders(
  p_now timestamptz,p_event_id uuid,p_limit integer default 10000)
returns table(delivery_id uuid,registration_id uuid,schedule_item_id uuid,
  wonderpush_installation_id text,title text,location_name text,starts_at timestamptz)
language sql security definer set search_path=public as $$
  with eligible as (
    select registration.id registration_id,star.schedule_item_id,
      registration.wonderpush_installation_id,item.title,item.location_name,item.starts_at
    from itinerary_reminder_installations registration
    join itinerary_reminder_stars star on star.registration_id=registration.id
    join schedule_items item on item.id=star.schedule_item_id and item.event_id=registration.event_id
    left join itinerary_reminder_deliveries existing on existing.registration_id=registration.id
      and existing.schedule_item_id=star.schedule_item_id and existing.reminder_type='itinerary_t30'
    where registration.event_id=p_event_id and registration.reminders_enabled
      and registration.provider_deliverable and registration.provider_reachability='optIn'
      and registration.provider_has_push_token and registration.provider_checked_at>p_now-interval '15 minutes'
      and item.status='published' and item.starts_at>p_now+interval '25 minutes'
      and item.starts_at<=p_now+interval '30 minutes' and star.starred_at<item.starts_at-interval '30 minutes'
      and (existing.id is null or (existing.status='provider_failed' and existing.attempt_count<3
        and existing.next_attempt_at<=p_now))
    order by item.starts_at,item.id,registration.id limit greatest(1,least(p_limit,10000))
  ), claimed as (
    insert into itinerary_reminder_deliveries(registration_id,schedule_item_id,reminder_type,status,attempt_count,updated_at)
      select registration_id,schedule_item_id,'itinerary_t30','claimed',1,p_now from eligible
      on conflict(registration_id,schedule_item_id,reminder_type) do update
        set status='claimed',claimed_at=p_now,attempt_count=itinerary_reminder_deliveries.attempt_count+1,
          updated_at=p_now,error_message=null,batch_id=null,batch_assigned_at=null
        where itinerary_reminder_deliveries.status='provider_failed'
          and itinerary_reminder_deliveries.attempt_count<3 and itinerary_reminder_deliveries.next_attempt_at<=p_now
      returning id,registration_id,schedule_item_id
  )
  select claimed.id,eligible.registration_id,eligible.schedule_item_id,
    eligible.wonderpush_installation_id,eligible.title,eligible.location_name,eligible.starts_at
  from claimed join eligible using(registration_id,schedule_item_id);
$$;

create or replace function public.claim_due_synthetic_itinerary_reminders(
  p_now timestamptz,p_event_id uuid,p_limit integer default 1000)
returns table(delivery_id uuid,registration_id uuid,synthetic_event_id uuid,
  wonderpush_installation_id text,title text,location_name text,starts_at timestamptz)
language sql security definer set search_path=public as $$
  with eligible as (
    select registration.id registration_id,star.synthetic_event_id,
      registration.wonderpush_installation_id,item.title,item.location_name,item.starts_at
    from itinerary_reminder_installations registration
    join itinerary_reminder_synthetic_stars star on star.registration_id=registration.id
    join itinerary_reminder_synthetic_events item on item.id=star.synthetic_event_id and item.event_id=registration.event_id
    left join itinerary_reminder_synthetic_deliveries existing on existing.registration_id=registration.id
      and existing.synthetic_event_id=star.synthetic_event_id and existing.reminder_type='itinerary_t30'
    where registration.event_id=p_event_id and registration.reminders_enabled
      and registration.provider_deliverable and registration.provider_reachability='optIn'
      and registration.provider_has_push_token and registration.provider_checked_at>p_now-interval '15 minutes'
      and item.status='published' and item.starts_at>p_now+interval '25 minutes'
      and item.starts_at<=p_now+interval '30 minutes' and star.starred_at<item.starts_at-interval '30 minutes'
      and (existing.id is null or (existing.status='provider_failed' and existing.attempt_count<3
        and existing.next_attempt_at<=p_now))
    order by item.starts_at,registration.id limit greatest(1,least(p_limit,10000))
  ), claimed as (
    insert into itinerary_reminder_synthetic_deliveries(registration_id,synthetic_event_id,reminder_type,status,attempt_count,updated_at)
      select registration_id,synthetic_event_id,'itinerary_t30','claimed',1,p_now from eligible
      on conflict(registration_id,synthetic_event_id,reminder_type) do update
        set status='claimed',claimed_at=p_now,attempt_count=itinerary_reminder_synthetic_deliveries.attempt_count+1,
          updated_at=p_now,error_message=null
        where itinerary_reminder_synthetic_deliveries.status='provider_failed'
          and itinerary_reminder_synthetic_deliveries.attempt_count<3
          and itinerary_reminder_synthetic_deliveries.next_attempt_at<=p_now
      returning id,registration_id,synthetic_event_id
  )
  select claimed.id,eligible.registration_id,eligible.synthetic_event_id,
    eligible.wonderpush_installation_id,eligible.title,eligible.location_name,eligible.starts_at
  from claimed join eligible using(registration_id,synthetic_event_id);
$$;

-- Existing service-role-only privileges are retained by CREATE OR REPLACE.
