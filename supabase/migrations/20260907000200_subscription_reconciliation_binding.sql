-- Additive one-use pilot invitation. Never alter the reviewed 00100 migration.
-- Only a trusted external operator may arm an invitation; no public arm route.
alter table public.notification_reconciliation_project
 add column binding_invitation_hash text check(binding_invitation_hash ~ '^[0-9a-f]{64}$'),
 add column binding_expires_at timestamptz,
 add column pilot_bound_at timestamptz;

create function public.ipm_bind_reconciliation_pilot(p jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 project public.notification_reconciliation_project;
 candidate uuid;
 candidates integer;
begin
 select * into project from public.notification_reconciliation_project where singleton for update;
 if not found or project.enabled or project.repair_enabled
    or project.pilot_registration_id is not null or project.pilot_bound_at is not null
    or project.binding_invitation_hash is null or project.binding_expires_at is null
    or project.binding_expires_at <= clock_timestamp()
    or p->>'event_slug' is distinct from 'ipm-2026'
    or coalesce(p->>'capability_hash','') !~ '^[0-9a-f]{64}$'
    or coalesce(p->>'invitation_hash','') !~ '^[0-9a-f]{64}$'
    or project.binding_invitation_hash is distinct from p->>'invitation_hash'
    or exists(select 1 from public.notification_reconciliation)
 then return jsonb_build_object('bound',false); end if;
 -- No caller-supplied registration or installation identifier is accepted.
 -- Lock the owned row to prevent concurrent capability rebinding during selection.
 for candidate in
   select i.id from public.notification_installations i
   join public.events e on e.id=i.event_id
   where i.capability_hash=p->>'capability_hash' and e.slug='ipm-2026'
     and i.wonderpush_installation_id ~ '^[A-Za-z0-9]{40}$'
   for update of i
 loop
   candidates := coalesce(candidates,0)+1;
 end loop;
 if candidates is distinct from 1 then return jsonb_build_object('bound',false); end if;
 update public.notification_reconciliation_project
 set pilot_registration_id=candidate, pilot_bound_at=clock_timestamp(),
     binding_invitation_hash=null, binding_expires_at=null
 where singleton;
 return jsonb_build_object('bound',true,'pilot_restriction_count',1,
                          'observation_enabled',false,'repair_enabled',false);
end $$;
revoke all on function public.ipm_bind_reconciliation_pilot(jsonb) from public,anon,authenticated;
grant execute on function public.ipm_bind_reconciliation_pilot(jsonb) to service_role;
-- Rollback only after disabling binding callers:
-- drop function public.ipm_bind_reconciliation_pilot(jsonb);
-- alter table public.notification_reconciliation_project drop column binding_invitation_hash,
--   drop column binding_expires_at, drop column pilot_bound_at;
-- Rollback preserves the pilot reference and existing rollout switches.
