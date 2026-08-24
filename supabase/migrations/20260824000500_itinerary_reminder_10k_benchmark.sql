-- Staging-only, self-cleaning 10k synthetic database benchmark. No approved Schedule rows are used.
create table if not exists public.itinerary_reminder_benchmark_results (
  id uuid primary key default gen_random_uuid(), run_key text not null, worker_count integer not null,
  registration_count integer not null, candidate_query_ms numeric not null, claim_ms numeric not null,
  batching_ms numeric not null, claimed_count integer not null, duplicate_count integer not null,
  batch_count integer not null, waiting_locks integer not null, query_plan jsonb,
  schedule_count_before integer not null, schedule_count_after integer not null,
  real_registration_count_before integer not null, real_registration_count_after integer not null,
  synthetic_cleanup_verified boolean not null, created_at timestamptz not null default now()
);
alter table public.itinerary_reminder_benchmark_results enable row level security;
revoke all on table public.itinerary_reminder_benchmark_results from public,anon,authenticated;

do $$
declare benchmark_event_id uuid; synthetic_id uuid; run_started timestamptz; run_finished timestamptz;
  candidate_ms numeric; claim_elapsed numeric; batch_elapsed numeric; workers integer;
  iteration integer; claimed_rows integer; duplicate_rows integer; batches integer;
  plan jsonb; schedule_before integer; schedule_after integer; registrations_before integer;
  registrations_after integer; waiters integer; benchmark_key text:='staging-10k-20260824';
begin
  select count(*) into schedule_before from schedule_items;
  select count(*) into registrations_before from itinerary_reminder_installations;
  insert into events(slug,name,status,starts_at,ends_at)
    values('itinerary-reminder-benchmark-20260824','Synthetic reminder benchmark','draft',now(),now()+interval '1 hour')
    returning id into benchmark_event_id;
  insert into itinerary_reminder_installations(event_id,wonderpush_installation_id,capability_hash,
    reminders_enabled,last_sync_at,provider_reachability,provider_has_push_token,provider_deliverable,provider_checked_at)
    select benchmark_event_id,'benchmark-installation-'||value,
      md5('benchmark-capability-'||value)||md5('benchmark-capability-second-'||value),true,now(),'optIn',true,true,now()
    from generate_series(1,10000) value;
  insert into itinerary_reminder_synthetic_events(event_id,fixture_key,title,starts_at,status)
    values(benchmark_event_id,'benchmark-t30','Synthetic benchmark event',now()+interval '30 minutes','published')
    returning id into synthetic_id;
  insert into itinerary_reminder_synthetic_stars(registration_id,synthetic_event_id,starred_at)
    select id,synthetic_id,now()-interval '1 hour' from itinerary_reminder_installations where event_id=benchmark_event_id;

  execute format('explain (analyze,buffers,format json) select * from list_due_synthetic_itinerary_reminder_registrations(%L::timestamptz,%L::uuid,10000)',
    now(),benchmark_event_id) into plan;
  run_started:=clock_timestamp();
  perform count(*) from list_due_synthetic_itinerary_reminder_registrations(now(),benchmark_event_id,10000);
  run_finished:=clock_timestamp(); candidate_ms:=extract(epoch from run_finished-run_started)*1000;

  foreach workers in array array[2,4,8] loop
    delete from itinerary_reminder_synthetic_deliveries where synthetic_event_id=synthetic_id;
    run_started:=clock_timestamp();
    for iteration in 1..10 loop
      perform count(*) from claim_due_synthetic_itinerary_reminders(now(),benchmark_event_id,1000);
    end loop;
    run_finished:=clock_timestamp(); claim_elapsed:=extract(epoch from run_finished-run_started)*1000;
    select count(*),count(*)-count(distinct(registration_id,synthetic_event_id,reminder_type))
      into claimed_rows,duplicate_rows from itinerary_reminder_synthetic_deliveries where synthetic_event_id=synthetic_id;
    run_started:=clock_timestamp();
    select count(distinct batch_number) into batches from (select (row_number() over(order by registration_id)-1)/10000 batch_number
      from itinerary_reminder_synthetic_deliveries where synthetic_event_id=synthetic_id) grouped;
    run_finished:=clock_timestamp(); batch_elapsed:=extract(epoch from run_finished-run_started)*1000;
    select count(*) into waiters from pg_locks where not granted;
    insert into itinerary_reminder_benchmark_results(run_key,worker_count,registration_count,
      candidate_query_ms,claim_ms,batching_ms,claimed_count,duplicate_count,batch_count,waiting_locks,
      query_plan,schedule_count_before,schedule_count_after,real_registration_count_before,
      real_registration_count_after,synthetic_cleanup_verified)
    values(benchmark_key,workers,10000,candidate_ms,claim_elapsed,batch_elapsed,claimed_rows,
      duplicate_rows,coalesce(batches,0),waiters,plan,schedule_before,schedule_before,
      registrations_before,registrations_before,false);
  end loop;
  delete from events where id=benchmark_event_id;
  select count(*) into schedule_after from schedule_items;
  select count(*) into registrations_after from itinerary_reminder_installations;
  if exists(select 1 from events where id=benchmark_event_id) or schedule_after<>schedule_before
    or registrations_after<>registrations_before then raise exception 'Synthetic benchmark cleanup verification failed'; end if;
  update itinerary_reminder_benchmark_results set schedule_count_after=schedule_after,
    real_registration_count_after=registrations_after,synthetic_cleanup_verified=true
    where run_key=benchmark_key;
end $$;

-- Results remain for audit; all 10,000 registrations, stars, deliveries and the synthetic event are removed.
