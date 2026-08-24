-- Durable WonderPush readiness mirror. Provider credentials and raw push tokens are never stored.
alter table public.itinerary_reminder_installations
  add column if not exists provider_subscription_state text,
  add column if not exists provider_updated_at text,
  add column if not exists provider_verification_source text,
  add column if not exists provider_verification_error text;

create table if not exists public.itinerary_reminder_provider_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  status text not null check(status in ('succeeded','failed')),
  full_refresh boolean not null default true,
  duration_ms integer not null default 0 check(duration_ms>=0),
  provider_requests integer not null default 0 check(provider_requests>=0),
  provider_installations_scanned integer not null default 0 check(provider_installations_scanned>=0),
  installations_processed integer not null default 0 check(installations_processed>=0),
  missing_installations integer not null default 0 check(missing_installations>=0),
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists itinerary_provider_refresh_event_finished_idx
  on public.itinerary_reminder_provider_refresh_runs(event_id,finished_at desc);
alter table public.itinerary_reminder_provider_refresh_runs enable row level security;
revoke all on public.itinerary_reminder_provider_refresh_runs from public,anon,authenticated;
grant all on public.itinerary_reminder_provider_refresh_runs to service_role;

create or replace function public.apply_itinerary_provider_readiness_refresh(
  p_event_id uuid,p_checked_at timestamptz,p_rows jsonb,p_full_refresh boolean,
  p_pages integer,p_duration_ms integer,p_error_message text default null)
returns table(updated_count integer,missing_count integer)
language plpgsql security definer set search_path=public as $$
declare updated_value integer:=0; missing_value integer:=0;
begin
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>50000 then
    raise exception 'Invalid provider readiness refresh payload';
  end if;
  with incoming as (
    select value->>'installation_id' installation_id,
      coalesce(value->>'reachability','unknown') reachability,
      coalesce((value->>'has_push_token')::boolean,false) has_push_token,
      nullif(value->>'subscription_state','') subscription_state,
      nullif(value->>'provider_updated_at','') provider_updated_at
    from jsonb_array_elements(p_rows)
  ), changed as (
    update itinerary_reminder_installations registration set
      provider_reachability=case when incoming.reachability in ('optIn','optOut','softOptOut')
        then incoming.reachability else 'unknown' end,
      provider_has_push_token=incoming.has_push_token,
      provider_deliverable=incoming.reachability='optIn' and incoming.has_push_token,
      provider_subscription_state=incoming.subscription_state,
      provider_updated_at=incoming.provider_updated_at,
      provider_checked_at=p_checked_at,
      provider_verification_source=case when p_full_refresh then 'wonderpush_list_full' else 'wonderpush_list_incremental' end,
      provider_verification_error=null,updated_at=now()
    from incoming where registration.event_id=p_event_id
      and registration.wonderpush_installation_id=incoming.installation_id
    returning registration.id
  ) select count(*) into updated_value from changed;

  if p_full_refresh then
    with incoming as (select value->>'installation_id' installation_id from jsonb_array_elements(p_rows)), missing as (
      update itinerary_reminder_installations registration set provider_reachability='unknown',
        provider_has_push_token=false,provider_deliverable=false,
        provider_subscription_state='unknown',provider_checked_at=p_checked_at,
        provider_verification_source='wonderpush_list_full_missing',
        provider_verification_error='Registered installation absent from full provider refresh',updated_at=now()
      where registration.event_id=p_event_id and not exists(select 1 from incoming
        where incoming.installation_id=registration.wonderpush_installation_id)
      returning registration.id
    ) select count(*) into missing_value from missing;
  end if;

  insert into itinerary_reminder_provider_refresh_runs(event_id,started_at,finished_at,status,
    full_refresh,duration_ms,provider_requests,provider_installations_scanned,
    installations_processed,missing_installations,error_message)
  values(p_event_id,p_checked_at,now(),'succeeded',p_full_refresh,greatest(p_duration_ms,0),
    greatest(p_pages,0),jsonb_array_length(p_rows),updated_value,missing_value,p_error_message);
  return query select updated_value,missing_value;
end $$;

create or replace function public.claim_due_itinerary_reminders_cached(
  p_now timestamptz,p_event_id uuid,p_limit integer default 10000,
  p_provider_readiness_max_age_seconds integer default 900)
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
      and registration.provider_has_push_token
      and registration.provider_checked_at>p_now-make_interval(secs=>greatest(60,p_provider_readiness_max_age_seconds))
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

create or replace function public.itinerary_provider_readiness_metrics(
  p_now timestamptz,p_event_id uuid,p_max_age_seconds integer default 900)
returns table(fresh_provider_ready bigint,stale_provider_readiness bigint,provider_opt_out bigint,
  provider_unknown bigint,last_successful_provider_refresh timestamptz,last_refresh_duration_ms integer,
  last_refresh_provider_requests integer,last_refresh_installations_processed integer,
  readiness_refresh_failures bigint,upcoming_t30_lacking_fresh_readiness bigint)
language sql security definer set search_path=public as $$
  select
    count(*) filter(where provider_deliverable and provider_reachability='optIn' and provider_has_push_token
      and provider_checked_at>p_now-make_interval(secs=>greatest(60,p_max_age_seconds))),
    count(*) filter(where provider_checked_at is null or provider_checked_at<=p_now-make_interval(secs=>greatest(60,p_max_age_seconds))),
    count(*) filter(where provider_reachability in ('optOut','softOptOut')),
    count(*) filter(where provider_reachability='unknown' or provider_reachability is null),
    (select max(finished_at) from itinerary_reminder_provider_refresh_runs where event_id=p_event_id and status='succeeded'),
    coalesce((select duration_ms from itinerary_reminder_provider_refresh_runs where event_id=p_event_id
      and status='succeeded' order by finished_at desc limit 1),0),
    coalesce((select provider_requests from itinerary_reminder_provider_refresh_runs where event_id=p_event_id
      and status='succeeded' order by finished_at desc limit 1),0),
    coalesce((select installations_processed from itinerary_reminder_provider_refresh_runs where event_id=p_event_id
      and status='succeeded' order by finished_at desc limit 1),0),
    (select count(*) from itinerary_reminder_provider_refresh_runs where event_id=p_event_id and status='failed'),
    (select count(*) from itinerary_reminder_stars star join schedule_items item on item.id=star.schedule_item_id
      join itinerary_reminder_installations candidate on candidate.id=star.registration_id
      where candidate.event_id=p_event_id and candidate.reminders_enabled and item.status='published'
        and item.starts_at>p_now+interval '30 minutes' and item.starts_at<=p_now+interval '45 minutes'
        and (not candidate.provider_deliverable or candidate.provider_checked_at is null
          or candidate.provider_checked_at<=p_now-make_interval(secs=>greatest(60,p_max_age_seconds))))
  from itinerary_reminder_installations where event_id=p_event_id;
$$;

revoke all on function public.apply_itinerary_provider_readiness_refresh(uuid,timestamptz,jsonb,boolean,integer,integer,text) from public,anon,authenticated;
revoke all on function public.claim_due_itinerary_reminders_cached(timestamptz,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.itinerary_provider_readiness_metrics(timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.apply_itinerary_provider_readiness_refresh(uuid,timestamptz,jsonb,boolean,integer,integer,text) to service_role;
grant execute on function public.claim_due_itinerary_reminders_cached(timestamptz,uuid,integer,integer) to service_role;
grant execute on function public.itinerary_provider_readiness_metrics(timestamptz,uuid,integer) to service_role;
