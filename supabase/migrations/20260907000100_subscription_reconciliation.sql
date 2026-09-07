-- Reversible, service-role-only coordination. No raw subscription material.
create table public.notification_reconciliation (
 registration_id uuid primary key references public.notification_installations(id) on delete cascade,
 fingerprint text not null check(length(fingerprint)=64),
 generation bigint not null default 1,
 status text not null default 'CHECK_DUE',
 subscription_verified_at timestamptz, verification_expires_at timestamptz,
 operation_id uuid, lease_until timestamptz,
 uncertain boolean not null default false,
 next_attempt_at timestamptz, outcome text,
 window_start timestamptz not null default now(), checks integer not null default 0,
 failures integer not null default 0,
 provider_checked_at timestamptz, provider_ready boolean,
 updated_at timestamptz not null default now()
);
create table public.notification_reconciliation_project (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false, repair_enabled boolean not null default false,
 window_start timestamptz not null default now(), checks integer not null default 0,
 failures integer not null default 0, open_until timestamptz
);
insert into public.notification_reconciliation_project(singleton) values(true);
alter table public.notification_reconciliation enable row level security;
alter table public.notification_reconciliation_project enable row level security;
revoke all on public.notification_reconciliation, public.notification_reconciliation_project from public, anon, authenticated;
grant all on public.notification_reconciliation, public.notification_reconciliation_project to service_role;

create function public.ipm_reconciliation(p jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 reg public.notification_installations; r public.notification_reconciliation;
 project public.notification_reconciliation_project;
 action text := p->>'action'; stamp timestamptz := clock_timestamp();
 retry_seconds integer;
begin
 -- Global row first: consistent lock ordering and bounded aggregate traffic.
 select * into project from public.notification_reconciliation_project where singleton for update;
 if not project.enabled then return jsonb_build_object('status','DEFERRED','outcome','DISABLED'); end if;
 select i.* into reg from public.notification_installations i join public.events e on e.id=i.event_id
 where i.capability_hash=p->>'capability_hash' and (e.slug=p->>'event_slug' or e.id::text=p->>'event_slug');
 if reg.id is null or reg.wonderpush_installation_id is distinct from p->>'installation_id' then
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
     status='COMPARING',operation_id=gen_random_uuid(),lease_until=stamp+interval '120 seconds',
     uncertain=r.uncertain,subscription_verified_at=r.subscription_verified_at,verification_expires_at=r.verification_expires_at,
     checks=r.checks+1,window_start=r.window_start,updated_at=stamp where registration_id=reg.id returning * into r;
   return to_jsonb(r)||jsonb_build_object('target',reg.wonderpush_installation_id,'repair_enabled',project.repair_enabled);
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
   if r.uncertain or not project.repair_enabled or r.status<>'COMPARING' then return jsonb_build_object('status','OUTCOME_UNKNOWN'); end if;
   update public.notification_reconciliation set status='PATCH_PENDING',uncertain=true,updated_at=stamp where registration_id=reg.id;
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
-- Rollback (after disabling callers): drop function public.ipm_reconciliation(jsonb);
-- drop table public.notification_reconciliation; drop table public.notification_reconciliation_project;
