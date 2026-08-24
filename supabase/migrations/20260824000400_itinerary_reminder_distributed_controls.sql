-- Shared staging controls for multiple itinerary-reminder workers.
create table if not exists public.itinerary_reminder_provider_controls (
  event_id uuid primary key references public.events(id) on delete cascade,
  tokens numeric not null default 10, last_refill_at timestamptz not null default now(),
  request_rate numeric not null default 10, burst_size integer not null default 10,
  breaker_state text not null default 'closed' check(breaker_state in ('closed','open','half_open')),
  breaker_open_until timestamptz, half_open_probe boolean not null default false,
  window_started_at timestamptz not null default now(), window_calls integer not null default 0,
  window_failures integer not null default 0, updated_at timestamptz not null default now()
);
create table if not exists public.itinerary_reminder_operational_alerts (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  alert_key text not null, severity text not null check(severity in ('warning','critical')),
  status text not null default 'open' check(status in ('open','resolved')),
  message text not null, details jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  resolved_at timestamptz, unique(event_id,alert_key)
);
alter table public.itinerary_reminder_provider_controls enable row level security;
alter table public.itinerary_reminder_operational_alerts enable row level security;
create index if not exists itinerary_reminder_operational_alerts_status_idx
  on public.itinerary_reminder_operational_alerts(event_id,status,severity,last_seen_at);

create or replace function public.acquire_itinerary_provider_slot(
  p_now timestamptz,p_event_id uuid,p_rate numeric,p_burst integer)
returns table(granted boolean,retry_after_ms integer,breaker_state text)
language plpgsql security definer set search_path=public as $$
declare control itinerary_reminder_provider_controls%rowtype; elapsed numeric;
begin
  insert into itinerary_reminder_provider_controls(event_id,tokens,request_rate,burst_size,last_refill_at)
    values(p_event_id,greatest(1,p_burst),greatest(0.1,p_rate),greatest(1,p_burst),p_now)
    on conflict(event_id) do nothing;
  select * into control from itinerary_reminder_provider_controls where event_id=p_event_id for update;
  if control.breaker_state='open' and control.breaker_open_until>p_now then
    return query select false,greatest(1,(extract(epoch from control.breaker_open_until-p_now)*1000)::integer),'open'::text;
    return;
  elsif control.breaker_state='open' then
    if control.half_open_probe then return query select false,1000,'half_open'::text; return; end if;
    update itinerary_reminder_provider_controls set breaker_state='half_open',half_open_probe=true,updated_at=p_now
      where event_id=p_event_id;
    return query select true,0,'half_open'::text;
    return;
  end if;
  elapsed:=greatest(0,extract(epoch from p_now-control.last_refill_at));
  control.tokens:=least(greatest(1,p_burst)::numeric,control.tokens+elapsed*greatest(0.1,p_rate));
  if control.tokens>=1 then
    update itinerary_reminder_provider_controls set tokens=control.tokens-1,last_refill_at=p_now,
      request_rate=greatest(0.1,p_rate),burst_size=greatest(1,p_burst),updated_at=p_now where event_id=p_event_id;
    return query select true,0,control.breaker_state;
  else
    update itinerary_reminder_provider_controls set tokens=control.tokens,last_refill_at=p_now,updated_at=p_now
      where event_id=p_event_id;
    return query select false,ceil((1-control.tokens)/greatest(0.1,p_rate)*1000)::integer,control.breaker_state;
  end if;
end; $$;

create or replace function public.record_itinerary_provider_outcome(
  p_now timestamptz,p_event_id uuid,p_success boolean,p_minimum_calls integer default 20,
  p_failure_threshold numeric default 0.5,p_cooldown_seconds integer default 60)
returns text language plpgsql security definer set search_path=public as $$
declare control itinerary_reminder_provider_controls%rowtype; calls integer; failures integer;
begin
  select * into control from itinerary_reminder_provider_controls where event_id=p_event_id for update;
  if control.event_id is null then return 'closed'; end if;
  if control.breaker_state='half_open' then
    update itinerary_reminder_provider_controls set breaker_state=case when p_success then 'closed' else 'open' end,
      breaker_open_until=case when p_success then null else p_now+make_interval(secs=>p_cooldown_seconds) end,
      half_open_probe=false,window_started_at=p_now,window_calls=0,window_failures=0,updated_at=p_now
      where event_id=p_event_id returning breaker_state into control.breaker_state;
    return control.breaker_state;
  end if;
  if control.window_started_at<p_now-interval '60 seconds' then calls:=1; failures:=case when p_success then 0 else 1 end;
  else calls:=control.window_calls+1; failures:=control.window_failures+case when p_success then 0 else 1 end; end if;
  update itinerary_reminder_provider_controls set window_started_at=case when control.window_started_at<p_now-interval '60 seconds' then p_now else window_started_at end,
    window_calls=calls,window_failures=failures,
    breaker_state=case when calls>=p_minimum_calls and failures::numeric/calls>=p_failure_threshold then 'open' else breaker_state end,
    breaker_open_until=case when calls>=p_minimum_calls and failures::numeric/calls>=p_failure_threshold then p_now+make_interval(secs=>p_cooldown_seconds) else breaker_open_until end,
    updated_at=p_now where event_id=p_event_id returning breaker_state into control.breaker_state;
  return control.breaker_state;
end; $$;

create or replace function public.mark_itinerary_batch_attempted(
  p_now timestamptz,p_batch_id uuid,p_lease_owner text,p_lease_seconds integer default 90)
returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  update itinerary_reminder_batches set status='provider_attempted',provider_attempted_at=p_now,
    lease_owner=p_lease_owner,leased_at=p_now,lease_expires_at=p_now+make_interval(secs=>p_lease_seconds),updated_at=p_now
    where id=p_batch_id and status='assigned' and lease_owner=p_lease_owner;
  get diagnostics changed=row_count; return changed=1;
end; $$;

create or replace function public.recover_expired_itinerary_batches(p_now timestamptz,p_event_id uuid)
returns table(released_pre_submit bigint,marked_ambiguous bigint)
language plpgsql security definer set search_path=public as $$
declare released bigint; ambiguous_ids uuid[];
begin
  update itinerary_reminder_batches set lease_owner=null,leased_at=null,lease_expires_at=null,updated_at=p_now
    where event_id=p_event_id and status='assigned' and lease_expires_at<p_now;
  get diagnostics released=row_count;
  select array(select id from itinerary_reminder_batches
    where event_id=p_event_id and status='provider_attempted' and lease_expires_at<p_now for update)
    into ambiguous_ids;
  update itinerary_reminder_batches set status='delivery_unknown',updated_at=p_now,
    error_message='Worker lease expired after provider submission may have begun' where id=any(coalesce(ambiguous_ids,'{}'::uuid[]));
  update itinerary_reminder_deliveries set status='delivery_unknown',updated_at=p_now,
    error_message='Worker lease expired after provider submission may have begun'
    where batch_id=any(coalesce(ambiguous_ids,'{}'::uuid[])) and status='claimed';
  return query select released,coalesce(array_length(ambiguous_ids,1),0)::bigint;
end; $$;

create or replace function public.lease_assigned_itinerary_batches(
  p_now timestamptz,p_event_id uuid,p_worker_id text,p_limit integer default 100,p_lease_seconds integer default 90)
returns table(batch_id uuid,delivery_id uuid,registration_id uuid,schedule_item_id uuid,
  wonderpush_installation_id text,title text,location_name text,starts_at timestamptz,idempotency_key text)
language sql security definer set search_path=public as $$
  with selected as (
    select batch.id from itinerary_reminder_batches batch
    join schedule_items item on item.id=batch.schedule_item_id and item.event_id=batch.event_id
    where batch.event_id=p_event_id and batch.status='assigned' and batch.lease_owner is null
      and item.status='published' and item.starts_at>p_now+interval '25 minutes'
      and item.starts_at<=p_now+interval '30 minutes'
    order by batch.created_at for update of batch skip locked limit greatest(1,least(p_limit,1000))
  ), leased as (
    update itinerary_reminder_batches batch set lease_owner=p_worker_id,leased_at=p_now,
      lease_expires_at=p_now+make_interval(secs=>p_lease_seconds),updated_at=p_now
    from selected where batch.id=selected.id returning batch.*
  )
  select leased.id,delivery.id,registration.id,item.id,registration.wonderpush_installation_id,
    item.title,item.location_name,item.starts_at,leased.idempotency_key
  from leased join itinerary_reminder_deliveries delivery on delivery.batch_id=leased.id and delivery.status='claimed'
  join itinerary_reminder_installations registration on registration.id=delivery.registration_id
  join itinerary_reminder_stars star on star.registration_id=registration.id and star.schedule_item_id=delivery.schedule_item_id
  join schedule_items item on item.id=delivery.schedule_item_id
  where registration.reminders_enabled and registration.provider_deliverable
    and registration.provider_reachability='optIn' and registration.provider_has_push_token
    and registration.provider_checked_at>p_now-interval '15 minutes'
    and star.starred_at<item.starts_at-interval '30 minutes'
  order by leased.id,registration.id;
$$;

create or replace function public.evaluate_itinerary_reminder_alerts(
  p_now timestamptz,p_event_id uuid,p_backlog_warning_seconds integer default 60,
  p_backlog_critical_seconds integer default 180)
returns table(open_alerts bigint) language plpgsql security definer set search_path=public as $$
declare oldest_seconds bigint; breaker text; ambiguous_count bigint; severity_value text;
begin
  select coalesce(extract(epoch from p_now-min(created_at))::bigint,0) into oldest_seconds
    from itinerary_reminder_batches where event_id=p_event_id and status in ('assigned','provider_failed');
  select breaker_state into breaker from itinerary_reminder_provider_controls where event_id=p_event_id;
  select count(*) into ambiguous_count from itinerary_reminder_batches
    where event_id=p_event_id and status='delivery_unknown';
  if oldest_seconds>=p_backlog_warning_seconds then
    severity_value:=case when oldest_seconds>=p_backlog_critical_seconds then 'critical' else 'warning' end;
    insert into itinerary_reminder_operational_alerts(event_id,alert_key,severity,status,message,details,opened_at,last_seen_at,resolved_at)
      values(p_event_id,'backlog_age',severity_value,'open','Itinerary reminder backlog exceeds threshold',
        jsonb_build_object('oldest_pending_seconds',oldest_seconds),p_now,p_now,null)
      on conflict(event_id,alert_key) do update set severity=excluded.severity,status='open',message=excluded.message,
        details=excluded.details,last_seen_at=p_now,resolved_at=null;
  else update itinerary_reminder_operational_alerts set status='resolved',resolved_at=p_now,last_seen_at=p_now
    where event_id=p_event_id and alert_key='backlog_age' and status='open'; end if;
  if breaker='open' then
    insert into itinerary_reminder_operational_alerts(event_id,alert_key,severity,status,message,details,opened_at,last_seen_at,resolved_at)
      values(p_event_id,'provider_circuit','critical','open','WonderPush itinerary-reminder circuit breaker is open','{}',p_now,p_now,null)
      on conflict(event_id,alert_key) do update set severity='critical',status='open',last_seen_at=p_now,resolved_at=null;
  else update itinerary_reminder_operational_alerts set status='resolved',resolved_at=p_now,last_seen_at=p_now
    where event_id=p_event_id and alert_key='provider_circuit' and status='open'; end if;
  if ambiguous_count>0 then
    insert into itinerary_reminder_operational_alerts(event_id,alert_key,severity,status,message,details,opened_at,last_seen_at,resolved_at)
      values(p_event_id,'delivery_unknown','warning','open','Itinerary reminder batches require outcome review',
        jsonb_build_object('delivery_unknown_batches',ambiguous_count),p_now,p_now,null)
      on conflict(event_id,alert_key) do update set status='open',details=excluded.details,last_seen_at=p_now,resolved_at=null;
  end if;
  return query select count(*) from itinerary_reminder_operational_alerts where event_id=p_event_id and status='open';
end; $$;

create or replace function public.itinerary_reminder_durable_metrics(p_now timestamptz,p_event_id uuid)
returns table(provider_5xx_batches bigint,open_operational_alerts bigint,
  average_batch_processing_ms bigint,p95_batch_processing_ms bigint)
language sql security definer set search_path=public as $$
  select
    (select count(*) from itinerary_reminder_batches where event_id=p_event_id and provider_http_status between 500 and 599),
    (select count(*) from itinerary_reminder_operational_alerts where event_id=p_event_id and status='open'),
    coalesce((select avg(extract(epoch from updated_at-created_at)*1000)::bigint from itinerary_reminder_batches
      where event_id=p_event_id and status in ('provider_accepted','provider_failed','delivery_unknown')),0),
    coalesce((select percentile_cont(.95) within group(order by extract(epoch from updated_at-created_at)*1000)::bigint
      from itinerary_reminder_batches where event_id=p_event_id and status in ('provider_accepted','provider_failed','delivery_unknown')),0);
$$;

create or replace function public.finish_itinerary_reminder_batch(
  p_now timestamptz,p_batch_id uuid,p_delivery_ids uuid[],p_status text,
  p_provider_delivery_id text,p_provider_http_status integer,p_error_message text,
  p_next_attempt_at timestamptz,p_rate_limit_limit integer,p_rate_limit_remaining integer,
  p_rate_limit_reset_seconds integer,p_retry_after_seconds integer
) returns void language plpgsql security definer set search_path=public as $$
declare expected_count integer; updated_count integer;
begin
  if p_status not in ('provider_accepted','provider_failed','delivery_unknown') then raise exception 'Invalid batch completion status'; end if;
  select target_count into expected_count from itinerary_reminder_batches
    where id=p_batch_id and status='provider_attempted' for update;
  if expected_count is null or expected_count<>coalesce(array_length(p_delivery_ids,1),0) then raise exception 'Batch completion mismatch'; end if;
  update itinerary_reminder_batches set status=p_status,updated_at=p_now,
    provider_accepted_at=case when p_status='provider_accepted' then p_now end,
    provider_delivery_id=p_provider_delivery_id,provider_http_status=p_provider_http_status,
    error_message=left(p_error_message,1000),next_attempt_at=p_next_attempt_at,
    attempt_count=attempt_count+1,rate_limit_limit=p_rate_limit_limit,
    rate_limit_remaining=p_rate_limit_remaining,rate_limit_reset_seconds=p_rate_limit_reset_seconds,
    retry_after_seconds=p_retry_after_seconds where id=p_batch_id;
  update itinerary_reminder_deliveries set status=p_status,updated_at=p_now,
    provider_request_attempted_at=p_now,provider_accepted_at=case when p_status='provider_accepted' then p_now end,
    failed_at=case when p_status='provider_failed' then p_now end,
    provider_delivery_id=p_provider_delivery_id,error_message=left(p_error_message,1000),
    next_attempt_at=case when p_status='provider_failed' then p_next_attempt_at end
    where id=any(p_delivery_ids) and batch_id=p_batch_id and status='claimed';
  get diagnostics updated_count=row_count;
  if updated_count<>expected_count then raise exception 'Individual batch ledger mismatch'; end if;
end; $$;

revoke all on table public.itinerary_reminder_provider_controls,public.itinerary_reminder_operational_alerts from public,anon,authenticated;
revoke all on function public.acquire_itinerary_provider_slot(timestamptz,uuid,numeric,integer) from public,anon,authenticated;
revoke all on function public.record_itinerary_provider_outcome(timestamptz,uuid,boolean,integer,numeric,integer) from public,anon,authenticated;
revoke all on function public.mark_itinerary_batch_attempted(timestamptz,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.recover_expired_itinerary_batches(timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.lease_assigned_itinerary_batches(timestamptz,uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.evaluate_itinerary_reminder_alerts(timestamptz,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.itinerary_reminder_durable_metrics(timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.acquire_itinerary_provider_slot(timestamptz,uuid,numeric,integer) to service_role;
grant execute on function public.record_itinerary_provider_outcome(timestamptz,uuid,boolean,integer,numeric,integer) to service_role;
grant execute on function public.mark_itinerary_batch_attempted(timestamptz,uuid,text,integer) to service_role;
grant execute on function public.recover_expired_itinerary_batches(timestamptz,uuid) to service_role;
grant execute on function public.lease_assigned_itinerary_batches(timestamptz,uuid,text,integer,integer) to service_role;
grant execute on function public.evaluate_itinerary_reminder_alerts(timestamptz,uuid,integer,integer) to service_role;
grant execute on function public.itinerary_reminder_durable_metrics(timestamptz,uuid) to service_role;

-- Rollback: drop the five functions, both tables and the alert index. No Schedule data changes.
