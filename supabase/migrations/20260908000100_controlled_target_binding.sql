-- Atomic capability-owned pilot selection from the existing controlled target.
-- The application reads the configured target internally; no browser identifier
-- is accepted. This function never reads or mutates provider state.
create function public.ipm_bind_controlled_target(p jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 project public.notification_reconciliation_project;
 candidate public.notification_installations;
 candidate_count integer;
begin
 select * into project from public.notification_reconciliation_project
   where singleton for update;
 if not found then return jsonb_build_object('reason','PROJECT_ABSENT'); end if;
 if project.pilot_registration_id is not null then return jsonb_build_object('reason','PILOT_ALREADY_SET'); end if;
 if project.enabled then return jsonb_build_object('reason','OBSERVATION_ON'); end if;
 if project.repair_enabled then return jsonb_build_object('reason','REPAIR_ON'); end if;
 if exists(select 1 from public.notification_reconciliation) then
   return jsonb_build_object('reason','METADATA_PRESENT');
 end if;
 if p->>'event_slug' is distinct from 'ipm-2026' then
   return jsonb_build_object('reason','EVENT_MISMATCH');
 end if;
 if coalesce(p->>'capability_hash','') !~ '^[0-9a-f]{64}$' then
   return jsonb_build_object('reason','CAPABILITY_INVALID');
 end if;
 if coalesce(p->>'controlled_target','') !~ '^[A-Za-z0-9]{40}$' then
   return jsonb_build_object('reason','CONTROLLED_TARGET_INVALID');
 end if;
 select count(*) into candidate_count
 from public.notification_installations i join public.events e on e.id=i.event_id
 where i.capability_hash=p->>'capability_hash' and e.slug='ipm-2026';
 if candidate_count=0 then return jsonb_build_object('reason','CAPABILITY_UNOWNED'); end if;
 if candidate_count<>1 then return jsonb_build_object('reason','REGISTRATION_COUNT'); end if;
 select i.* into candidate
 from public.notification_installations i join public.events e on e.id=i.event_id
 where i.capability_hash=p->>'capability_hash' and e.slug='ipm-2026'
 for update of i;
 if candidate.wonderpush_installation_id is distinct from p->>'controlled_target' then
   return jsonb_build_object('reason','CONTROLLED_TARGET_MISMATCH');
 end if;
 update public.notification_reconciliation_project
 set pilot_registration_id=candidate.id
 where singleton and pilot_registration_id is null and not enabled and not repair_enabled;
 if not found then return jsonb_build_object('reason','PILOT_ALREADY_SET'); end if;
 return jsonb_build_object('bound',true,'pilot_restriction_count',1,
   'controlled_target_count',1,'controlled_target_match',true,
   'observation_enabled',false,'repair_enabled',false);
end $$;
revoke all on function public.ipm_bind_controlled_target(jsonb) from public,anon,authenticated;
grant execute on function public.ipm_bind_controlled_target(jsonb) to service_role;
-- Rollback after disabling the caller: drop function public.ipm_bind_controlled_target(jsonb);
