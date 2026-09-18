-- Staging-only outer gate for the real attendee T-30 acceptance test.
-- The normal claim/provider implementation remains unchanged; this table and
-- function are inert unless the staging service explicitly invokes them.
create table if not exists public.staging_t30_allowlists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid not null references public.itinerary_reminder_installations(id) on delete cascade,
  schedule_item_id uuid not null references public.schedule_items(id) on delete cascade,
  reminder_type text not null check (reminder_type = 'itinerary_t30'),
  expires_at timestamptz not null,
  claimed_count integer not null default 0 check (claimed_count between 0 and 1),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, registration_id, schedule_item_id, reminder_type)
);
alter table public.staging_t30_allowlists enable row level security;
revoke all on table public.staging_t30_allowlists from public, anon, authenticated;

create or replace function public.claim_staging_allowlisted_itinerary_reminder(
  p_now timestamptz, p_event_id uuid, p_registration_id uuid,
  p_schedule_item_id uuid, p_limit integer default 1
) returns table(delivery_id uuid, registration_id uuid, schedule_item_id uuid,
  wonderpush_installation_id text, title text, location_name text, starts_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare gate staging_t30_allowlists%rowtype; item schedule_items%rowtype;
  installation itinerary_reminder_installations%rowtype; star itinerary_reminder_stars%rowtype; claimed uuid;
begin
  if p_limit <> 1 then return; end if;
  select * into gate from staging_t30_allowlists
    where event_id=p_event_id and registration_id=p_registration_id
      and schedule_item_id=p_schedule_item_id and reminder_type='itinerary_t30'
      and enabled and expires_at > p_now and claimed_count=0 for update;
  if not found then return; end if;
  select * into installation from itinerary_reminder_installations
    where id=p_registration_id and event_id=p_event_id and reminders_enabled
      and provider_deliverable and provider_reachability='optIn' and provider_has_push_token
      and provider_checked_at > p_now-interval '15 minutes';
  if not found then return; end if;
  select * into item from schedule_items
    where id=p_schedule_item_id and event_id=p_event_id and status='published'
      and starts_at > p_now+interval '25 minutes' and starts_at <= p_now+interval '30 minutes';
  if not found then return; end if;
  select * into star from itinerary_reminder_stars
    where registration_id=p_registration_id and schedule_item_id=p_schedule_item_id
      and starred_at < item.starts_at-interval '30 minutes';
  if not found then return; end if;
  select d.id into claimed from itinerary_reminder_deliveries d
    where d.registration_id=p_registration_id and d.schedule_item_id=p_schedule_item_id
      and d.reminder_type='itinerary_t30';
  if claimed is not null then return; end if;
  insert into itinerary_reminder_deliveries(registration_id,schedule_item_id,reminder_type,status,attempt_count,updated_at)
    values(p_registration_id,p_schedule_item_id,'itinerary_t30','claimed',1,p_now)
    returning id into claimed;
  update staging_t30_allowlists set claimed_count=1,enabled=false,updated_at=p_now where id=gate.id;
  return query select claimed,installation.id,item.id,installation.wonderpush_installation_id,
    item.title,item.location_name,item.starts_at;
end; $$;
revoke all on function public.claim_staging_allowlisted_itinerary_reminder(timestamptz,uuid,uuid,uuid,integer) from public,anon,authenticated;
