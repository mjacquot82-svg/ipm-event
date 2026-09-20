-- Staging content revisions for version-gated attendee reads.
-- This migration is applied only to the IPM staging Supabase project.

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
security invoker
set search_path = public
as $$
declare
  changed_event_id uuid;
  changed_type text := tg_argv[0];
begin
  if tg_op in ('UPDATE', 'DELETE') then
    changed_event_id := old.event_id;
    insert into public.content_revisions(event_id, content_type, revision, updated_at)
    values (changed_event_id, changed_type, 1, now())
    on conflict (event_id, content_type) do update
      set revision = public.content_revisions.revision + 1,
          updated_at = now();
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    changed_event_id := new.event_id;
    insert into public.content_revisions(event_id, content_type, revision, updated_at)
    values (changed_event_id, changed_type, 1, now())
    on conflict (event_id, content_type) do update
      set revision = public.content_revisions.revision + 1,
          updated_at = now();
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists bump_schedule_content_revision on public.schedule_items;
create trigger bump_schedule_content_revision
after insert or update or delete on public.schedule_items
for each row execute function public.bump_content_revision('schedule');

drop trigger if exists bump_announcement_content_revision on public.alerts;
create trigger bump_announcement_content_revision
after insert or update or delete on public.alerts
for each row execute function public.bump_content_revision('announcements');

insert into public.content_revisions(event_id, content_type, revision, updated_at)
select e.id, content_type, 1, now()
from public.events e
cross join (values ('schedule'::text), ('announcements'::text)) types(content_type)
on conflict (event_id, content_type) do nothing;
