-- Keep valid attendee favorites synchronized when an older favorite is no
-- longer publishable. In-scope archived/cancelled rows are stale input, not
-- a reason to reject the entire desired set. Unknown or cross-event UUIDs
-- remain fatal so this cannot become an authorization bypass.
create or replace function public.sync_itinerary_reminder_stars(
  p_registration_id uuid, p_schedule_item_ids uuid[]
) returns table(starred_count bigint) language plpgsql security definer set search_path=public as $$
declare
  registration_event_id uuid;
  removed_count bigint;
  desired_ids uuid[] := coalesce(p_schedule_item_ids, '{}'::uuid[]);
begin
  select event_id into registration_event_id
    from itinerary_reminder_installations
    where id=p_registration_id for update;
  if registration_event_id is null then
    raise exception 'Unknown reminder registration';
  end if;

  -- A UUID that never belonged to this event scope remains a hard failure.
  -- Existing archived/cancelled/unpublished rows are recognized as stale
  -- attendee state and are filtered below.
  if exists(
    select 1 from unnest(desired_ids) supplied(id)
    where not exists (
      select 1 from schedule_items item
      where item.id=supplied.id and item.event_id=registration_event_id
    )
  ) then
    raise exception 'Unknown or cross-event Schedule UUID';
  end if;

  -- Reconcile the complete set atomically against currently publishable rows.
  delete from itinerary_reminder_stars star
    where star.registration_id=p_registration_id
      and not exists (
        select 1 from unnest(desired_ids) supplied(id)
        join schedule_items item
          on item.id=supplied.id
         and item.event_id=registration_event_id
         and item.status='published'
        where item.id=star.schedule_item_id
      );
  get diagnostics removed_count = row_count;

  insert into itinerary_reminder_stars(registration_id,schedule_item_id)
    select p_registration_id, item.id
      from unnest(desired_ids) supplied(id)
      join schedule_items item
        on item.id=supplied.id
       and item.event_id=registration_event_id
       and item.status='published'
     group by item.id
    on conflict do nothing;

  update itinerary_reminder_installations
     set last_sync_at=now(), last_error=null,
         removed_star_count=removed_star_count+removed_count
   where id=p_registration_id;

  return query
    select count(*) from itinerary_reminder_stars
     where registration_id=p_registration_id;
end; $$;

revoke all on function public.sync_itinerary_reminder_stars(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.sync_itinerary_reminder_stars(uuid, uuid[])
  to service_role;
