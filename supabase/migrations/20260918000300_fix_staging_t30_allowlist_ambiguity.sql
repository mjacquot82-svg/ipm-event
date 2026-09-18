-- Qualify every wrapper reference and avoid OUT-parameter/column name collisions.
create or replace function public.claim_staging_allowlisted_itinerary_reminder(
  p_now timestamptz, p_event_id uuid, p_registration_id uuid,
  p_schedule_item_id uuid, p_limit integer default 1
) returns table(delivery_id uuid, registration_id uuid, schedule_item_id uuid,
  wonderpush_installation_id text, title text, location_name text, starts_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare
  gate_row public.staging_t30_allowlists%rowtype;
  item_row public.schedule_items%rowtype;
  reg_row public.itinerary_reminder_installations%rowtype;
  star_row public.itinerary_reminder_stars%rowtype;
  existing_delivery_id uuid;
  claim_id uuid;
begin
  if p_limit <> 1 then return; end if;

  select g.* into gate_row
    from public.staging_t30_allowlists as g
    where g.event_id = p_event_id
      and g.registration_id = p_registration_id
      and g.schedule_item_id = p_schedule_item_id
      and g.reminder_type = 'itinerary_t30'
      and g.enabled
      and g.expires_at > p_now
      and g.claimed_count = 0
    for update;
  if not found then return; end if;

  select r.* into reg_row
    from public.itinerary_reminder_installations as r
    where r.id = p_registration_id
      and r.event_id = p_event_id
      and r.reminders_enabled
      and r.provider_deliverable
      and r.provider_reachability = 'optIn'
      and r.provider_has_push_token
      and r.provider_checked_at > p_now - interval '15 minutes';
  if not found then return; end if;

  select i.* into item_row
    from public.schedule_items as i
    where i.id = p_schedule_item_id
      and i.event_id = p_event_id
      and i.status = 'published'
      and i.starts_at > p_now + interval '25 minutes'
      and i.starts_at <= p_now + interval '30 minutes';
  if not found then return; end if;

  select s.* into star_row
    from public.itinerary_reminder_stars as s
    where s.registration_id = p_registration_id
      and s.schedule_item_id = p_schedule_item_id
      and s.starred_at < item_row.starts_at - interval '30 minutes';
  if not found then return; end if;

  select d.id into existing_delivery_id
    from public.itinerary_reminder_deliveries as d
    where d.registration_id = p_registration_id
      and d.schedule_item_id = p_schedule_item_id
      and d.reminder_type = 'itinerary_t30';
  if existing_delivery_id is not null then return; end if;

  insert into public.itinerary_reminder_deliveries
    (registration_id, schedule_item_id, reminder_type, status, attempt_count, updated_at)
  values
    (p_registration_id, p_schedule_item_id, 'itinerary_t30', 'claimed', 1, p_now)
  returning id into claim_id;

  update public.staging_t30_allowlists as g
    set claimed_count = 1, enabled = false, updated_at = p_now
    where g.id = gate_row.id;

  delivery_id := claim_id;
  registration_id := reg_row.id;
  schedule_item_id := item_row.id;
  wonderpush_installation_id := reg_row.wonderpush_installation_id;
  title := item_row.title;
  location_name := item_row.location_name;
  starts_at := item_row.starts_at;
  return next;
end; $$;
revoke all on function public.claim_staging_allowlisted_itinerary_reminder(timestamptz,uuid,uuid,uuid,integer) from public,anon,authenticated;
