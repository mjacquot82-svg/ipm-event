-- Self-cleaning staging benchmark for the readiness-mirror critical path.
create table if not exists public.itinerary_provider_readiness_benchmark_results (
  id uuid primary key default gen_random_uuid(),run_key text not null unique,
  registration_count integer not null,modeled_provider_pages integer not null,
  readiness_update_ms numeric not null,candidate_query_ms numeric not null,
  claim_ms numeric not null,batching_ms numeric not null,claimed_count integer not null,
  duplicate_count integer not null,scheduler_readiness_provider_calls integer not null,
  schedule_count_before integer not null,schedule_count_after integer not null,
  real_registration_count_before integer not null,real_registration_count_after integer not null,
  synthetic_cleanup_verified boolean not null default false,query_plan jsonb,created_at timestamptz not null default now()
);
alter table public.itinerary_provider_readiness_benchmark_results enable row level security;
revoke all on public.itinerary_provider_readiness_benchmark_results from public,anon,authenticated;
grant select,insert,update on public.itinerary_provider_readiness_benchmark_results to service_role;

do $$
declare event_id_value uuid; synthetic_id uuid; started timestamptz; readiness_ms numeric;
  candidate_ms numeric; claim_ms_value numeric; batching_ms numeric; claimed integer; duplicates integer;
  schedule_before integer; schedule_after integer; registrations_before integer; registrations_after integer; plan jsonb;
begin
  select count(*) into schedule_before from schedule_items;
  select count(*) into registrations_before from itinerary_reminder_installations;
  insert into events(slug,name,status,starts_at,ends_at)
    values('itinerary-readiness-benchmark-20260824','Synthetic readiness benchmark','draft',now(),now()+interval '1 hour')
    returning id into event_id_value;
  insert into itinerary_reminder_installations(event_id,wonderpush_installation_id,capability_hash,
    reminders_enabled,last_sync_at,provider_reachability,provider_has_push_token,provider_deliverable,provider_checked_at,
    provider_subscription_state,provider_verification_source)
    select event_id_value,'readiness-benchmark-installation-'||value,
      md5('readiness-benchmark-'||value)||md5('readiness-benchmark-second-'||value),true,now(),
      'unknown',false,false,null,'unknown','benchmark_unverified'
    from generate_series(1,10000) value;
  insert into itinerary_reminder_synthetic_events(event_id,fixture_key,title,starts_at,status)
    values(event_id_value,'readiness-benchmark-t30','Synthetic readiness benchmark event',now()+interval '30 minutes','published')
    returning id into synthetic_id;
  insert into itinerary_reminder_synthetic_stars(registration_id,synthetic_event_id,starred_at)
    select id,synthetic_id,now()-interval '1 hour' from itinerary_reminder_installations where event_id=event_id_value;

  started:=clock_timestamp();
  update itinerary_reminder_installations set provider_reachability='optIn',provider_has_push_token=true,
    provider_deliverable=true,provider_checked_at=now(),provider_subscription_state='optIn',
    provider_verification_source='wonderpush_list_full',provider_verification_error=null
    where event_id=event_id_value;
  readiness_ms:=extract(epoch from clock_timestamp()-started)*1000;
  insert into itinerary_reminder_provider_refresh_runs(event_id,started_at,finished_at,status,full_refresh,
    duration_ms,provider_requests,provider_installations_scanned,installations_processed,missing_installations)
    values(event_id_value,started,clock_timestamp(),'succeeded',true,readiness_ms::integer,10,10000,10000,0);

  execute format('explain (analyze,buffers,format json) select * from list_due_synthetic_itinerary_reminder_registrations(%L::timestamptz,%L::uuid,10000)',now(),event_id_value) into plan;
  started:=clock_timestamp();perform count(*) from list_due_synthetic_itinerary_reminder_registrations(now(),event_id_value,10000);
  candidate_ms:=extract(epoch from clock_timestamp()-started)*1000;
  started:=clock_timestamp();perform count(*) from claim_due_synthetic_itinerary_reminders(now(),event_id_value,10000);
  claim_ms_value:=extract(epoch from clock_timestamp()-started)*1000;
  select count(*),count(*)-count(distinct(registration_id,synthetic_event_id,reminder_type)) into claimed,duplicates
    from itinerary_reminder_synthetic_deliveries where synthetic_event_id=synthetic_id;
  started:=clock_timestamp();perform count(*) from (select (row_number() over(order by registration_id)-1)/10000
    from itinerary_reminder_synthetic_deliveries where synthetic_event_id=synthetic_id) grouped;
  batching_ms:=extract(epoch from clock_timestamp()-started)*1000;
  insert into itinerary_provider_readiness_benchmark_results(run_key,registration_count,modeled_provider_pages,
    readiness_update_ms,candidate_query_ms,claim_ms,batching_ms,claimed_count,duplicate_count,
    scheduler_readiness_provider_calls,schedule_count_before,schedule_count_after,
    real_registration_count_before,real_registration_count_after,query_plan)
  values('staging-readiness-cache-10k-20260824',10000,10,readiness_ms,candidate_ms,claim_ms_value,
    batching_ms,claimed,duplicates,0,schedule_before,schedule_before,registrations_before,registrations_before,plan);
  delete from events where id=event_id_value;
  select count(*) into schedule_after from schedule_items;
  select count(*) into registrations_after from itinerary_reminder_installations;
  if schedule_after<>schedule_before or registrations_after<>registrations_before
    or exists(select 1 from events where id=event_id_value) then raise exception 'Readiness benchmark cleanup failed';end if;
  update itinerary_provider_readiness_benchmark_results set schedule_count_after=schedule_after,
    real_registration_count_after=registrations_after,synthetic_cleanup_verified=true
    where run_key='staging-readiness-cache-10k-20260824';
end $$;
