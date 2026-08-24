-- Fresh self-cleaning benchmark after the claim anti-join correction.
do $$
declare event_id_value uuid; synthetic_id uuid; started timestamptz; workers integer; iteration integer;
  candidate_ms numeric; claim_ms numeric; batching_ms numeric; claimed integer; duplicates integer;
  batches integer; waiters integer; plan jsonb; schedule_before integer; schedule_after integer;
  registrations_before integer; registrations_after integer;
begin
  select count(*) into schedule_before from schedule_items;
  select count(*) into registrations_before from itinerary_reminder_installations;
  insert into events(slug,name,status,starts_at,ends_at)
    values('itinerary-reminder-benchmark-retest-20260824','Synthetic reminder benchmark retest','draft',now(),now()+interval '1 hour')
    returning id into event_id_value;
  insert into itinerary_reminder_installations(event_id,wonderpush_installation_id,capability_hash,
    reminders_enabled,last_sync_at,provider_reachability,provider_has_push_token,provider_deliverable,provider_checked_at)
    select event_id_value,'benchmark-retest-installation-'||value,
      md5('benchmark-retest-'||value)||md5('benchmark-retest-second-'||value),true,now(),'optIn',true,true,now()
    from generate_series(1,10000) value;
  insert into itinerary_reminder_synthetic_events(event_id,fixture_key,title,starts_at,status)
    values(event_id_value,'benchmark-t30-retest','Synthetic benchmark event retest',now()+interval '30 minutes','published')
    returning id into synthetic_id;
  insert into itinerary_reminder_synthetic_stars(registration_id,synthetic_event_id,starred_at)
    select id,synthetic_id,now()-interval '1 hour' from itinerary_reminder_installations where event_id=event_id_value;
  execute format('explain (analyze,buffers,format json) select * from list_due_synthetic_itinerary_reminder_registrations(%L::timestamptz,%L::uuid,10000)',now(),event_id_value) into plan;
  started:=clock_timestamp(); perform count(*) from list_due_synthetic_itinerary_reminder_registrations(now(),event_id_value,10000);
  candidate_ms:=extract(epoch from clock_timestamp()-started)*1000;
  foreach workers in array array[2,4,8] loop
    delete from itinerary_reminder_synthetic_deliveries where synthetic_event_id=synthetic_id;
    started:=clock_timestamp();
    for iteration in 1..workers loop
      perform count(*) from claim_due_synthetic_itinerary_reminders(now(),event_id_value,ceil(10000.0/workers)::integer);
    end loop;
    claim_ms:=extract(epoch from clock_timestamp()-started)*1000;
    select count(*),count(*)-count(distinct(registration_id,synthetic_event_id,reminder_type)) into claimed,duplicates
      from itinerary_reminder_synthetic_deliveries where synthetic_event_id=synthetic_id;
    started:=clock_timestamp();
    select count(distinct batch_number) into batches from (select (row_number() over(order by registration_id)-1)/10000 batch_number
      from itinerary_reminder_synthetic_deliveries where synthetic_event_id=synthetic_id) grouped;
    batching_ms:=extract(epoch from clock_timestamp()-started)*1000;
    select count(*) into waiters from pg_locks where not granted;
    insert into itinerary_reminder_benchmark_results(run_key,worker_count,registration_count,candidate_query_ms,
      claim_ms,batching_ms,claimed_count,duplicate_count,batch_count,waiting_locks,query_plan,
      schedule_count_before,schedule_count_after,real_registration_count_before,real_registration_count_after,synthetic_cleanup_verified)
    values('staging-10k-claim-fix-20260824',workers,10000,candidate_ms,claim_ms,batching_ms,claimed,
      duplicates,batches,waiters,plan,schedule_before,schedule_before,registrations_before,registrations_before,false);
  end loop;
  delete from events where id=event_id_value;
  select count(*) into schedule_after from schedule_items;
  select count(*) into registrations_after from itinerary_reminder_installations;
  if schedule_after<>schedule_before or registrations_after<>registrations_before
    or exists(select 1 from events where id=event_id_value) then raise exception 'Benchmark retest cleanup failed'; end if;
  update itinerary_reminder_benchmark_results set schedule_count_after=schedule_after,
    real_registration_count_after=registrations_after,synthetic_cleanup_verified=true
    where run_key='staging-10k-claim-fix-20260824';
end $$;
