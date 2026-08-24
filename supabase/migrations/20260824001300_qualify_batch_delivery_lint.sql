-- Preserve the function while eliminating the output-column/column-name ambiguity.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.assign_itinerary_reminder_batch(timestamptz,uuid,uuid,uuid[],text)'::regprocedure)
    into definition;
  definition:=replace(definition,
    'update itinerary_reminder_deliveries set batch_id=new_batch_id,batch_assigned_at=p_now,updated_at=p_now
    where id=any(p_delivery_ids) and status=''claimed'' and batch_id is null',
    'update itinerary_reminder_deliveries delivery set batch_id=new_batch_id,batch_assigned_at=p_now,updated_at=p_now
    where delivery.id=any(p_delivery_ids) and delivery.status=''claimed'' and delivery.batch_id is null');
  execute definition;
end $$;
