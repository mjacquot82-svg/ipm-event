-- Staging-only controlled reminder arm.  The attendee star remains the source
-- of truth; the fixture authorization only grants an accelerated due window.
alter table public.itinerary_reminder_deliveries
  add column if not exists controlled_fixture_id uuid
    references public.itinerary_reminder_synthetic_events(id) on delete set null,
  add column if not exists controlled_lead_minutes integer
    check (controlled_lead_minutes is null or controlled_lead_minutes between 1 and 30);

create index if not exists itinerary_reminder_deliveries_controlled_fixture_idx
  on public.itinerary_reminder_deliveries(controlled_fixture_id)
  where controlled_fixture_id is not null;

create or replace function public.claim_controlled_real_itinerary_reminder(
  p_now timestamptz,
  p_event_id uuid,
  p_fixture_id uuid,
  p_registration_id uuid,
  p_schedule_item_id uuid,
  p_staging_guard boolean default false
) returns table(
  delivery_id uuid,
  registration_id uuid,
  schedule_item_id uuid,
  wonderpush_installation_id text,
  title text,
  location_name text,
  starts_at timestamptz,
  controlled_fixture_id uuid,
  controlled_lead_minutes integer
)
language plpgsql security definer set search_path = public as $$
declare
  fixture_record itinerary_reminder_synthetic_events%rowtype;
  auth_record itinerary_reminder_synthetic_authorizations%rowtype;
  registration_record itinerary_reminder_installations%rowtype;
  item_record schedule_items%rowtype;
  star_record itinerary_reminder_stars%rowtype;
  claimed_id uuid;
begin
  if not p_staging_guard then raise exception 'Controlled reminder arm is staging-only'; end if;

  select * into fixture_record from itinerary_reminder_synthetic_events
    where id=p_fixture_id and event_id=p_event_id and status='published' for update;
  if not found then raise exception 'Unknown or unavailable controlled fixture'; end if;

  select * into auth_record from itinerary_reminder_synthetic_authorizations
    where synthetic_event_id=p_fixture_id and event_id=p_event_id
      and registration_id=p_registration_id and reminder_type='itinerary_t30'
      and consumed_at is null and expires_at>p_now for update;
  if not found then raise exception 'Missing, expired, or consumed controlled authorization'; end if;

  select * into registration_record from itinerary_reminder_installations
    where id=p_registration_id and event_id=p_event_id and test_device_label='A'
      and reminders_enabled and provider_deliverable
      and provider_reachability='optIn' and provider_has_push_token
      and provider_checked_at>p_now-interval '15 minutes';
  if not found then raise exception 'Controlled registration is not ready'; end if;

  select * into item_record from schedule_items
    where id=p_schedule_item_id and event_id=p_event_id and status='published';
  if not found then raise exception 'Unknown or unavailable Schedule event'; end if;

  select * into star_record from itinerary_reminder_stars
    where registration_id=p_registration_id and schedule_item_id=p_schedule_item_id;
  if not found then raise exception 'A real attendee star is required'; end if;

  if fixture_record.test_lead_minutes is null then
    raise exception 'Controlled fixture has no test lead';
  end if;
  if item_record.starts_at <= p_now + make_interval(mins => fixture_record.test_lead_minutes - 1)
     or item_record.starts_at > p_now + make_interval(mins => fixture_record.test_lead_minutes)
     or star_record.starred_at >= item_record.starts_at - make_interval(mins => fixture_record.test_lead_minutes) then
    raise exception 'Controlled reminder is outside its fixture window';
  end if;

  insert into itinerary_reminder_deliveries(
    registration_id, schedule_item_id, reminder_type, status, attempt_count,
    claimed_at, updated_at, controlled_fixture_id, controlled_lead_minutes
  ) values (
    p_registration_id, p_schedule_item_id, 'itinerary_t30', 'claimed', 1,
    p_now, p_now, p_fixture_id, fixture_record.test_lead_minutes
  ) on conflict (registration_id, schedule_item_id, reminder_type) do nothing
  returning id into claimed_id;

  if claimed_id is null then
    return;
  end if;

  update itinerary_reminder_synthetic_authorizations
    set consumed_at=p_now where id=auth_record.id and consumed_at is null;

  return query select claimed_id, p_registration_id, p_schedule_item_id,
    registration_record.wonderpush_installation_id, item_record.title,
    item_record.location_name, item_record.starts_at, p_fixture_id,
    fixture_record.test_lead_minutes;
end;
$$;

revoke all on function public.claim_controlled_real_itinerary_reminder(timestamptz,uuid,uuid,uuid,uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.claim_controlled_real_itinerary_reminder(timestamptz,uuid,uuid,uuid,uuid,boolean)
  to service_role;
