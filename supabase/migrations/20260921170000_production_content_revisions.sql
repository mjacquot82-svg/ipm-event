-- Production attendee content revisions and publisher singleton lease.
-- Revisions are event-scoped and only expose a monotonic counter to the
-- backend publisher. Attendee clients read the published Netlify manifest,
-- never this table or Supabase directly.
create table if not exists public.content_revisions (
  event_id uuid not null references public.events(id) on delete cascade,
  content_type text not null check (content_type in ('schedule', 'announcements')),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (event_id, content_type)
);

alter table public.content_revisions enable row level security;
revoke all on public.content_revisions from anon, authenticated;

create or replace function public.bump_content_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_event_id uuid;
  affected_type text := TG_ARGV[0];
begin
  affected_event_id := coalesce(NEW.event_id, OLD.event_id);
  insert into public.content_revisions(event_id, content_type, revision, updated_at)
  values (affected_event_id, affected_type, 1, now())
  on conflict (event_id, content_type) do update
    set revision = public.content_revisions.revision + 1,
        updated_at = excluded.updated_at;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists bump_production_schedule_content_revision on public.schedule_items;
create trigger bump_production_schedule_content_revision
after insert or update or delete on public.schedule_items
for each row execute function public.bump_content_revision('schedule');

drop trigger if exists bump_production_announcement_content_revision on public.alerts;
create trigger bump_production_announcement_content_revision
after insert or update or delete on public.alerts
for each row execute function public.bump_content_revision('announcements');

insert into public.content_revisions(event_id, content_type, revision, updated_at)
select id, content_type, 1, now()
from public.events
cross join (values ('schedule'::text), ('announcements'::text)) types(content_type)
where slug = 'ipm-2026'
on conflict (event_id, content_type) do nothing;

create table if not exists public.content_manifest_publish_leases (
  lease_key text primary key,
  owner text not null,
  lease_until timestamptz not null
);

alter table public.content_manifest_publish_leases enable row level security;
revoke all on public.content_manifest_publish_leases from anon, authenticated;
