-- Additive, inactive by default. No production control or cohort is changed here.
alter table public.notification_reconciliation
 add column observed_at timestamptz,
 add column observed_capability_hash text,
 add column observed_installation_hash text,
 add column validation_until timestamptz,
 add column validation_capability_hash text,
 add column validation_installation_hash text,
 add column patch_attempts integer not null default 0;

-- Private operator RPC. A support reference is a locator, NEVER authorization.
-- Invoke only after a known staff member gives explicit consent and privately
-- supplies the reference read from their own capability-owned app response.
create function public.ipm_designate_staff_validation(p jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 project public.notification_reconciliation_project;
 reg public.notification_installations; r public.notification_reconciliation;
 matches integer; stamp timestamptz := clock_timestamp();
begin
 if jsonb_typeof(p) <> 'object' or p - 'reference' - 'consent' <> '{}'::jsonb
    or p->>'reference' !~ '^[A-F0-9]{10}$' or p->>'consent' is distinct from 'true' then
   return jsonb_build_object('designated',false); end if;
 select * into project from public.notification_reconciliation_project where singleton for update;
 if project.singleton is not true then return jsonb_build_object('status','DEFERRED','designated',false,'pilot_eligible',false); end if;
 if project.mode <> 'POPULATION_REPAIR_STAGED' or project.repair_cohort_percent <> 0
    or not project.enabled or not project.repair_enabled or project.open_until > stamp
    or project.failures <> 0 or exists(select 1 from public.notification_reconciliation where uncertain)
 then return jsonb_build_object('designated',false); end if;
 select count(*) into matches from public.notification_installations i join public.events e on e.id=i.event_id
 where e.slug='ipm-2026' and upper(left(encode(sha256(convert_to(i.wonderpush_installation_id,'UTF8')),'hex'),10))=p->>'reference';
 if matches <> 1 then return jsonb_build_object('designated',false); end if;
 select i.* into reg from public.notification_installations i join public.events e on e.id=i.event_id
 where e.slug='ipm-2026' and upper(left(encode(sha256(convert_to(i.wonderpush_installation_id,'UTF8')),'hex'),10))=p->>'reference';
 if (select count(*) from public.notification_installations where capability_hash=reg.capability_hash and event_id=reg.event_id) <> 1
 then return jsonb_build_object('designated',false); end if;
 select * into r from public.notification_reconciliation where registration_id=reg.id for update;
 if r.registration_id is null or r.observed_at is null or r.observed_at < stamp-interval '15 minutes'
    or r.observed_capability_hash is distinct from reg.capability_hash
    or r.observed_installation_hash is distinct from encode(sha256(convert_to(reg.wonderpush_installation_id,'UTF8')),'hex')
    or r.lease_until > stamp or r.uncertain or r.status not in ('VERIFIED','MISMATCH','INELIGIBLE')
 then return jsonb_build_object('designated',false); end if;
 if (select count(*) from public.notification_reconciliation where validation_until > stamp and registration_id<>reg.id) >= 3
 then return jsonb_build_object('designated',false); end if;
 update public.notification_reconciliation set validation_until=stamp+interval '24 hours',
   validation_capability_hash=reg.capability_hash,validation_installation_hash=r.observed_installation_hash
 where registration_id=reg.id;
 return jsonb_build_object('designated',true,'expires_at',stamp+interval '24 hours');
end $$;
revoke all on function public.ipm_designate_staff_validation(jsonb) from public,anon,authenticated;
grant execute on function public.ipm_designate_staff_validation(jsonb) to service_role;

-- Read-only capability lookup for the normal settings support reference.
create function public.ipm_staff_validation_reference(p jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare reg public.notification_installations; matches integer;
begin
 if p->>'event_slug' is distinct from 'ipm-2026' then return '{}'::jsonb; end if;
 select count(*) into matches from public.notification_installations i join public.events e on e.id=i.event_id
 where e.slug='ipm-2026' and i.capability_hash=p->>'capability_hash';
 if matches<>1 then return '{}'::jsonb; end if;
 select i.* into reg from public.notification_installations i join public.events e on e.id=i.event_id
 where e.slug='ipm-2026' and i.capability_hash=p->>'capability_hash';
 return jsonb_build_object('reference',upper(left(encode(sha256(convert_to(reg.wonderpush_installation_id,'UTF8')),'hex'),10)));
end $$;
revoke all on function public.ipm_staff_validation_reference(jsonb) from public,anon,authenticated;
grant execute on function public.ipm_staff_validation_reference(jsonb) to service_role;

create or replace function public.ipm_reconciliation(p jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 reg public.notification_installations; r public.notification_reconciliation;
 project public.notification_reconciliation_project;
 action text := p->>'action'; stamp timestamptz := clock_timestamp();
 retry_seconds integer; repair_allowed boolean := false; owner_count integer;
begin
 -- Global row first: consistent lock ordering and bounded aggregate traffic.
 select * into project from public.notification_reconciliation_project where singleton for update;
 if project.singleton is not true then return jsonb_build_object('status','DEFERRED','designated',false,'pilot_eligible',false); end if;

 select count(*) into owner_count from public.notification_installations i join public.events e on e.id=i.event_id
 where i.capability_hash=p->>'capability_hash' and (e.slug=p->>'event_slug' or e.id::text=p->>'event_slug');
 if owner_count <> 1 then return jsonb_build_object('status','INELIGIBLE','pilot_eligible',false); end if;
 select i.* into reg from public.notification_installations i join public.events e on e.id=i.event_id
 where i.capability_hash=p->>'capability_hash' and (e.slug=p->>'event_slug' or e.id::text=p->>'event_slug');
 if reg.id is null or (project.mode = 'PILOT' and (project.pilot_registration_id is null or reg.id is distinct from project.pilot_registration_id)) then
   return jsonb_build_object('status','INELIGIBLE','outcome','NOT_PILOT','pilot_eligible',false);
 end if;
 select * into r from public.notification_reconciliation where registration_id=reg.id for update;
 repair_allowed := coalesce(project.repair_enabled and (project.mode='PILOT' or
   (project.mode='POPULATION_REPAIR_STAGED' and
     (mod(abs(hashtextextended(reg.id::text, 0)), 100) < project.repair_cohort_percent or
       (r.validation_until > stamp and project.failures=0 and
        not exists(select 1 from public.notification_reconciliation u where u.uncertain) and
        r.validation_capability_hash = reg.capability_hash and
        r.validation_installation_hash = encode(sha256(convert_to(reg.wonderpush_installation_id,'UTF8')),'hex') and
        exists(select 1 from public.events e where e.id=reg.event_id and e.slug='ipm-2026'))))),false);
 if action='eligibility' then
   return jsonb_build_object('pilot_eligible',true,'observation_enabled',project.enabled,
     'repair_enabled',repair_allowed);
 end if;
 if not project.enabled then return jsonb_build_object('status','DEFERRED','outcome','DISABLED'); end if;
 if reg.wonderpush_installation_id is distinct from p->>'installation_id' then
   return jsonb_build_object('status','IDENTITY_UNRESOLVED');
 end if;
 if action='claim' then
   insert into public.notification_reconciliation(registration_id,fingerprint)
     values(reg.id,p->>'fingerprint') on conflict do nothing;
 end if;
 select * into r from public.notification_reconciliation where registration_id=reg.id for update;
 if r.registration_id is null then return jsonb_build_object('status','CHECK_DUE'); end if;
 if action in ('claim','invalidate') and r.generation<>coalesce((p->>'generation')::bigint,1) then
   return jsonb_build_object('status','CHECK_DUE','generation',r.generation,'outcome','STALE_GENERATION');
 end if;
 if action='invalidate' then
   if r.fingerprint is distinct from p->>'fingerprint' then
     update public.notification_reconciliation set fingerprint=p->>'fingerprint',generation=generation+1,
       status='CHECK_DUE',verification_expires_at=null,subscription_verified_at=null,
       uncertain=uncertain or status in ('PATCH_PENDING','VERIFYING'),updated_at=stamp where registration_id=reg.id;
   end if;
   return jsonb_build_object('status','CHECK_DUE');
 end if;
 if action='claim' then
   if r.lease_until>stamp then return jsonb_build_object('status','DEFERRED','next_attempt_at',r.lease_until); end if;
   if r.status in ('PATCH_PENDING','VERIFYING') and r.operation_id is not null then r.uncertain:=true; end if;
   if r.fingerprint is distinct from p->>'fingerprint' then
     r.fingerprint:=p->>'fingerprint';r.generation:=r.generation+1;
     r.subscription_verified_at:=null;r.verification_expires_at:=null;
   elsif r.status='VERIFIED' and r.verification_expires_at>stamp then
     return jsonb_build_object('status','VERIFIED','generation',r.generation,
       'subscription_verified_at',r.subscription_verified_at,'verification_expires_at',r.verification_expires_at);
   end if;
   if r.next_attempt_at>stamp then return jsonb_build_object('status','DEFERRED','next_attempt_at',r.next_attempt_at); end if;
   if project.open_until>stamp then return jsonb_build_object('status','DEFERRED','next_attempt_at',project.open_until,'outcome','CIRCUIT_OPEN'); end if;
   if r.window_start+interval '1 hour'<=stamp then r.checks:=0;r.window_start:=stamp; end if;
   if project.window_start+interval '1 minute'<=stamp then project.checks:=0;project.window_start:=stamp; end if;
   if r.checks>=4 then return jsonb_build_object('status','DEFERRED','next_attempt_at',r.window_start+interval '1 hour','outcome','RATE_LIMIT'); end if;
   if project.checks>=120 then return jsonb_build_object('status','DEFERRED','next_attempt_at',project.window_start+interval '1 minute','outcome','RATE_LIMIT'); end if;
   update public.notification_reconciliation_project set checks=project.checks+1,window_start=project.window_start where singleton;
   update public.notification_reconciliation set fingerprint=r.fingerprint,generation=r.generation,
     observed_at=stamp,observed_capability_hash=reg.capability_hash,
     observed_installation_hash=encode(sha256(convert_to(reg.wonderpush_installation_id,'UTF8')),'hex'),
     status='COMPARING',operation_id=gen_random_uuid(),lease_until=stamp+interval '120 seconds',
     uncertain=r.uncertain,subscription_verified_at=r.subscription_verified_at,verification_expires_at=r.verification_expires_at,
     checks=r.checks+1,window_start=r.window_start,updated_at=stamp where registration_id=reg.id returning * into r;
   return to_jsonb(r)||jsonb_build_object('target',reg.wonderpush_installation_id,'repair_enabled',repair_allowed);
 end if;
 if r.fingerprint is distinct from p->>'fingerprint' or r.generation<>(p->>'generation')::bigint then
   return jsonb_build_object('status','CHECK_DUE','outcome','STALE_GENERATION');
 end if;
 if action='confirm' then
   if r.status='VERIFYING' and r.lease_until>stamp then
     update public.notification_reconciliation set status='VERIFIED',subscription_verified_at=stamp,
       verification_expires_at=stamp+interval '6 hours',operation_id=null,lease_until=null,
       uncertain=false,failures=0,next_attempt_at=null,outcome=null,updated_at=stamp where registration_id=reg.id returning * into r;
   end if;
   return jsonb_build_object('status',r.status,'generation',r.generation,'subscription_verified_at',r.subscription_verified_at,'verification_expires_at',r.verification_expires_at);
 end if;
 if r.operation_id::text is distinct from p->>'operation_id' or r.lease_until<=stamp then
   return jsonb_build_object('status','OUTCOME_UNKNOWN','outcome','LEASE_LOST');
 end if;
 if action='patch' then
   if project.open_until > stamp or r.uncertain or repair_allowed is not true or r.status<>'COMPARING' then return jsonb_build_object('status','OUTCOME_UNKNOWN'); end if;
   update public.notification_reconciliation set patch_attempts=patch_attempts+1,status='PATCH_PENDING',uncertain=true,updated_at=stamp where registration_id=reg.id;
   return jsonb_build_object('status','PATCH_PENDING');
 end if;
 if action='finish' then
   retry_seconds:=case when r.failures=0 then 30 when r.failures=1 then 120 else 600 end;
   retry_seconds:=greatest(retry_seconds,least(86400,coalesce((p->>'retry_after')::integer,0)));
   if p->>'outcome' in ('AUTH','BILLING','POLICY') then retry_seconds:=greatest(retry_seconds,3600); end if;
   update public.notification_reconciliation set status=p->>'status',outcome=p->>'outcome',
     provider_checked_at=case when p ? 'provider_ready' then stamp else provider_checked_at end,
     provider_ready=case when p ? 'provider_ready' then (p->>'provider_ready')::boolean else provider_ready end,
     lease_until=case when p->>'status'='VERIFYING' then stamp+interval '120 seconds' else null end,
     operation_id=case when p->>'status'='VERIFYING' then operation_id else null end,
     uncertain=case when p->>'status'='VERIFYING' or
       (p->>'status'='DEFERRED' and p->>'clear_uncertain'='true' and p->>'outcome' in ('AUTH','BILLING','POLICY','RATE_LIMIT','DATA','IDENTITY'))
       then false else uncertain end,
     failures=case when p->>'status'='VERIFYING' then 0 else failures+1 end,
     next_attempt_at=case when p->>'status'='VERIFYING' then null else stamp+make_interval(secs=>retry_seconds) end,
     updated_at=stamp where registration_id=reg.id;
   if p->>'outcome' in ('NETWORK','PROVIDER','AUTH','BILLING','POLICY','RATE_LIMIT') then
     update public.notification_reconciliation_project set failures=failures+1,
       open_until=case when failures>=4 or p->>'outcome' in ('AUTH','BILLING','POLICY','RATE_LIMIT')
         then stamp+make_interval(secs=>retry_seconds) else open_until end where singleton;
   elsif p->>'status'='VERIFYING' then
     update public.notification_reconciliation_project set failures=case when open_until>stamp then failures else 0 end,
       open_until=case when open_until>stamp then open_until else null end where singleton;
   end if;
   return jsonb_build_object('status',p->>'status','generation',r.generation,
     'next_attempt_at',case when p->>'status'='VERIFYING' then null else stamp+make_interval(secs=>retry_seconds) end,'outcome',p->>'outcome');
 end if;
 return jsonb_build_object('status','DEFERRED');
end $$;
revoke all on function public.ipm_reconciliation(jsonb) from public,anon,authenticated;
grant execute on function public.ipm_reconciliation(jsonb) to service_role;
