create or replace function public.assign_itinerary_reminder_batch(
  p_now timestamptz,p_event_id uuid,p_schedule_item_id uuid,p_delivery_ids uuid[],p_idempotency_key text)
returns table(batch_id uuid,target_count integer)
language plpgsql security definer set search_path=public as $$
declare new_batch_id uuid;supplied_count integer;valid_count integer;assigned_count integer;
begin
  supplied_count:=coalesce(array_length(p_delivery_ids,1),0);
  if supplied_count<1 or supplied_count>10000 then raise exception 'Invalid exact target batch size';end if;
  if supplied_count<>(select count(distinct value) from unnest(p_delivery_ids) value) then
    raise exception 'Duplicate delivery IDs are prohibited';end if;
  select count(*) into valid_count from itinerary_reminder_deliveries delivery
  join itinerary_reminder_installations registration on registration.id=delivery.registration_id
  join itinerary_reminder_stars star on star.registration_id=registration.id and star.schedule_item_id=delivery.schedule_item_id
  join schedule_items item on item.id=delivery.schedule_item_id and item.event_id=registration.event_id
  where delivery.id=any(p_delivery_ids) and delivery.status='claimed' and delivery.batch_id is null
    and delivery.reminder_type='itinerary_t30' and delivery.schedule_item_id=p_schedule_item_id
    and registration.event_id=p_event_id and registration.reminders_enabled
    and registration.provider_deliverable and registration.provider_reachability='optIn'
    and registration.provider_has_push_token and registration.provider_checked_at>p_now-interval '15 minutes'
    and item.status='published' and item.starts_at>p_now+interval '25 minutes'
    and item.starts_at<=p_now+interval '30 minutes' and star.starred_at<item.starts_at-interval '30 minutes';
  if valid_count<>supplied_count then raise exception 'Batch contains an ineligible or mismatched reminder claim';end if;
  select batch.id into new_batch_id from itinerary_reminder_batches batch
    where batch.idempotency_key=p_idempotency_key and batch.event_id=p_event_id
      and batch.schedule_item_id=p_schedule_item_id and batch.target_count=supplied_count
      and batch.status='provider_failed' and batch.next_attempt_at<=p_now for update;
  if new_batch_id is null then
    insert into itinerary_reminder_batches(event_id,schedule_item_id,target_count,idempotency_key,
      lease_owner,leased_at,lease_expires_at) values(p_event_id,p_schedule_item_id,supplied_count,
      p_idempotency_key,'scheduler',p_now,p_now+interval '2 minutes') returning id into new_batch_id;
  else update itinerary_reminder_batches set status='assigned',leased_at=p_now,
    lease_expires_at=p_now+interval '2 minutes',updated_at=p_now,error_message=null where id=new_batch_id;end if;
  update itinerary_reminder_deliveries set batch_id=new_batch_id,batch_assigned_at=p_now,updated_at=p_now
    where id=any(p_delivery_ids) and status='claimed' and batch_id is null;
  get diagnostics assigned_count=row_count;
  if assigned_count<>supplied_count then raise exception 'Batch assignment race lost';end if;
  return query select new_batch_id,supplied_count;
end $$;
revoke all on function public.assign_itinerary_reminder_batch(timestamptz,uuid,uuid,uuid[],text) from public,anon,authenticated;
grant execute on function public.assign_itinerary_reminder_batch(timestamptz,uuid,uuid,uuid[],text) to service_role;
