create or replace function public.evaluate_itinerary_provider_readiness_alert(
  p_now timestamptz,p_event_id uuid,p_max_age_seconds integer default 900,p_warning_count integer default 1)
returns table(upcoming_lacking_fresh_readiness bigint,alert_open boolean)
language plpgsql security definer set search_path=public as $$
declare lacking bigint;
begin
  select count(*) into lacking from itinerary_reminder_stars star
    join schedule_items item on item.id=star.schedule_item_id
    join itinerary_reminder_installations registration on registration.id=star.registration_id
    where registration.event_id=p_event_id and registration.reminders_enabled and item.status='published'
      and item.starts_at>p_now+interval '30 minutes' and item.starts_at<=p_now+interval '45 minutes'
      and (not registration.provider_deliverable or registration.provider_checked_at is null
        or registration.provider_checked_at<=p_now-make_interval(secs=>greatest(60,p_max_age_seconds)));
  if lacking>=greatest(1,p_warning_count) then
    insert into itinerary_reminder_operational_alerts(event_id,alert_key,severity,status,message,details,opened_at,last_seen_at,resolved_at)
      values(p_event_id,'provider_readiness_stale','critical','open',
        'Upcoming itinerary reminders lack fresh provider readiness',
        jsonb_build_object('upcoming_lacking_fresh_readiness',lacking),p_now,p_now,null)
      on conflict(event_id,alert_key) do update set severity='critical',status='open',
        message=excluded.message,details=excluded.details,last_seen_at=p_now,resolved_at=null;
  else
    update itinerary_reminder_operational_alerts set status='resolved',resolved_at=p_now,last_seen_at=p_now
      where event_id=p_event_id and alert_key='provider_readiness_stale' and status='open';
  end if;
  return query select lacking,lacking>=greatest(1,p_warning_count);
end $$;
revoke all on function public.evaluate_itinerary_provider_readiness_alert(timestamptz,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.evaluate_itinerary_provider_readiness_alert(timestamptz,uuid,integer,integer) to service_role;
