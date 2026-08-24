-- Additive staging persistence for event-grouped exact-installation delivery batches.
create table if not exists public.itinerary_reminder_batches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  schedule_item_id uuid not null references public.schedule_items(id) on delete cascade,
  reminder_type text not null default 'itinerary_t30' check (reminder_type='itinerary_t30'),
  status text not null default 'assigned' check (status in
    ('assigned','provider_attempted','provider_accepted','provider_failed','delivery_unknown')),
  target_count integer not null check (target_count between 1 and 10000),
  idempotency_key text not null unique check (char_length(idempotency_key)<=64),
  lease_owner text, leased_at timestamptz, lease_expires_at timestamptz,
  provider_attempted_at timestamptz, provider_accepted_at timestamptz,
  provider_delivery_id text, provider_http_status integer,
  rate_limit_limit integer, rate_limit_remaining integer,
  rate_limit_reset_seconds integer, retry_after_seconds integer,
  next_attempt_at timestamptz, attempt_count integer not null default 0,
  error_message text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.itinerary_reminder_batches enable row level security;

alter table public.itinerary_reminder_deliveries
  add column if not exists batch_id uuid references public.itinerary_reminder_batches(id),
  add column if not exists batch_assigned_at timestamptz,
  add column if not exists provider_request_attempted_at timestamptz;

create index if not exists itinerary_reminder_batches_queue_idx
  on public.itinerary_reminder_batches(status,next_attempt_at,lease_expires_at,created_at);
create index if not exists itinerary_reminder_batches_event_idx
  on public.itinerary_reminder_batches(event_id,schedule_item_id,reminder_type,status);
create index if not exists itinerary_reminder_deliveries_batch_idx
  on public.itinerary_reminder_deliveries(batch_id,status);

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
    where registration.event_id=p_event_id and registration.reminders_enabled
      and registration.provider_deliverable and registration.provider_reachability='optIn'
      and registration.provider_has_push_token
      and registration.provider_checked_at>p_now-interval '15 minutes'
      and item.status='published' and item.starts_at>p_now+interval '25 minutes'
      and item.starts_at<=p_now+interval '30 minutes'
      and star.starred_at<item.starts_at-interval '30 minutes'
    order by item.starts_at,item.id,registration.id limit greatest(1,least(p_limit,10000))
  ), claimed as (
    insert into itinerary_reminder_deliveries(registration_id,schedule_item_id,reminder_type,status,attempt_count,updated_at)
      select registration_id,schedule_item_id,'itinerary_t30','claimed',1,p_now from eligible
      on conflict(registration_id,schedule_item_id,reminder_type) do update
        set status='claimed',claimed_at=p_now,attempt_count=itinerary_reminder_deliveries.attempt_count+1,
          updated_at=p_now,error_message=null,batch_id=null,batch_assigned_at=null
        where itinerary_reminder_deliveries.status='provider_failed'
          and itinerary_reminder_deliveries.attempt_count<3
          and itinerary_reminder_deliveries.next_attempt_at<=p_now
      returning id,registration_id,schedule_item_id
  )
  select claimed.id,eligible.registration_id,eligible.schedule_item_id,
    eligible.wonderpush_installation_id,eligible.title,eligible.location_name,eligible.starts_at
  from claimed join eligible using(registration_id,schedule_item_id);
$$;

create or replace function public.assign_itinerary_reminder_batch(
  p_now timestamptz, p_event_id uuid, p_schedule_item_id uuid,
  p_delivery_ids uuid[], p_idempotency_key text
) returns table(batch_id uuid,target_count integer)
language plpgsql security definer set search_path=public as $$
declare new_batch_id uuid; supplied_count integer; valid_count integer; assigned_count integer;
begin
  supplied_count:=coalesce(array_length(p_delivery_ids,1),0);
  if supplied_count<1 or supplied_count>10000 then raise exception 'Invalid exact target batch size'; end if;
  if supplied_count<>(select count(distinct value) from unnest(p_delivery_ids) value) then
    raise exception 'Duplicate delivery IDs are prohibited';
  end if;
  select count(*) into valid_count
  from itinerary_reminder_deliveries delivery
  join itinerary_reminder_installations registration on registration.id=delivery.registration_id
  join itinerary_reminder_stars star on star.registration_id=registration.id and star.schedule_item_id=delivery.schedule_item_id
  join schedule_items item on item.id=delivery.schedule_item_id and item.event_id=registration.event_id
  where delivery.id=any(p_delivery_ids) and delivery.status='claimed' and delivery.batch_id is null
    and delivery.reminder_type='itinerary_t30' and delivery.schedule_item_id=p_schedule_item_id
    and registration.event_id=p_event_id and registration.reminders_enabled
    and registration.provider_deliverable and registration.provider_reachability='optIn'
    and registration.provider_has_push_token and registration.provider_checked_at>p_now-interval '15 minutes'
    and item.status='published' and item.starts_at>p_now+interval '25 minutes'
    and item.starts_at<=p_now+interval '30 minutes'
    and star.starred_at<item.starts_at-interval '30 minutes';
  if valid_count<>supplied_count then raise exception 'Batch contains an ineligible or mismatched reminder claim'; end if;

  select id into new_batch_id from itinerary_reminder_batches
    where idempotency_key=p_idempotency_key and event_id=p_event_id
      and schedule_item_id=p_schedule_item_id and target_count=supplied_count
      and status='provider_failed' and next_attempt_at<=p_now for update;
  if new_batch_id is null then
    insert into itinerary_reminder_batches(event_id,schedule_item_id,target_count,idempotency_key,
      lease_owner,leased_at,lease_expires_at)
    values(p_event_id,p_schedule_item_id,supplied_count,p_idempotency_key,
      'scheduler',p_now,p_now+interval '2 minutes') returning id into new_batch_id;
  else
    update itinerary_reminder_batches set status='assigned',leased_at=p_now,
      lease_expires_at=p_now+interval '2 minutes',updated_at=p_now,error_message=null
      where id=new_batch_id;
  end if;
  update itinerary_reminder_deliveries set batch_id=new_batch_id,batch_assigned_at=p_now,updated_at=p_now
    where id=any(p_delivery_ids) and status='claimed' and batch_id is null;
  get diagnostics assigned_count = row_count;
  if assigned_count<>supplied_count then raise exception 'Batch assignment race lost'; end if;
  return query select new_batch_id,supplied_count;
end; $$;

create or replace function public.finish_itinerary_reminder_batch(
  p_now timestamptz,p_batch_id uuid,p_delivery_ids uuid[],p_status text,
  p_provider_delivery_id text,p_provider_http_status integer,p_error_message text,
  p_next_attempt_at timestamptz,p_rate_limit_limit integer,p_rate_limit_remaining integer,
  p_rate_limit_reset_seconds integer,p_retry_after_seconds integer
) returns void language plpgsql security definer set search_path=public as $$
declare expected_count integer; updated_count integer;
begin
  if p_status not in ('provider_accepted','provider_failed','delivery_unknown') then
    raise exception 'Invalid batch completion status'; end if;
  select target_count into expected_count from itinerary_reminder_batches
    where id=p_batch_id and status='assigned' for update;
  if expected_count is null or expected_count<>coalesce(array_length(p_delivery_ids,1),0) then
    raise exception 'Batch completion mismatch'; end if;
  update itinerary_reminder_batches set status=p_status,updated_at=p_now,
    provider_attempted_at=p_now,provider_accepted_at=case when p_status='provider_accepted' then p_now end,
    provider_delivery_id=p_provider_delivery_id,provider_http_status=p_provider_http_status,
    error_message=left(p_error_message,1000),next_attempt_at=p_next_attempt_at,
    attempt_count=attempt_count+1,rate_limit_limit=p_rate_limit_limit,
    rate_limit_remaining=p_rate_limit_remaining,rate_limit_reset_seconds=p_rate_limit_reset_seconds,
    retry_after_seconds=p_retry_after_seconds where id=p_batch_id;
  update itinerary_reminder_deliveries set status=p_status,updated_at=p_now,
    provider_request_attempted_at=p_now,
    provider_accepted_at=case when p_status='provider_accepted' then p_now end,
    failed_at=case when p_status='provider_failed' then p_now end,
    provider_delivery_id=p_provider_delivery_id,error_message=left(p_error_message,1000),
    next_attempt_at=case when p_status='provider_failed' then p_next_attempt_at end
    where id=any(p_delivery_ids) and batch_id=p_batch_id and status='claimed';
  get diagnostics updated_count = row_count;
  if updated_count<>expected_count then raise exception 'Individual batch ledger mismatch'; end if;
end; $$;

create or replace function public.itinerary_reminder_batch_metrics(p_now timestamptz,p_event_id uuid)
returns table(assigned_batches bigint,provider_accepted_batches bigint,provider_failed_batches bigint,
  delivery_unknown_batches bigint,targeted_installations bigint,provider_429_batches bigint,
  current_backlog bigint,oldest_pending_seconds bigint)
language sql security definer set search_path=public as $$
  select
    count(*) filter(where status='assigned'),
    count(*) filter(where status='provider_accepted'),
    count(*) filter(where status='provider_failed'),
    count(*) filter(where status='delivery_unknown'),
    coalesce(sum(target_count),0),
    count(*) filter(where provider_http_status=429),
    count(*) filter(where status in ('assigned','provider_failed')),
    coalesce(extract(epoch from p_now-min(created_at) filter(where status in ('assigned','provider_failed')))::bigint,0)
  from itinerary_reminder_batches where event_id=p_event_id;
$$;

revoke all on function public.assign_itinerary_reminder_batch(timestamptz,uuid,uuid,uuid[],text)
  from public,anon,authenticated;
grant execute on function public.assign_itinerary_reminder_batch(timestamptz,uuid,uuid,uuid[],text)
  to service_role;
revoke all on function public.finish_itinerary_reminder_batch(timestamptz,uuid,uuid[],text,text,integer,text,timestamptz,integer,integer,integer,integer)
  from public,anon,authenticated;
grant execute on function public.finish_itinerary_reminder_batch(timestamptz,uuid,uuid[],text,text,integer,text,timestamptz,integer,integer,integer,integer)
  to service_role;
revoke all on function public.itinerary_reminder_batch_metrics(timestamptz,uuid)
  from public,anon,authenticated;
grant execute on function public.itinerary_reminder_batch_metrics(timestamptz,uuid) to service_role;

-- Rollback: drop assign_itinerary_reminder_batch, the three indexes, added delivery
-- columns, and itinerary_reminder_batches. No Schedule or attendee rows are modified.
