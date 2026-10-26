-- Server-side scheduled announcement delivery queue.
create table if not exists public.announcement_scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  announcement_id uuid not null references public.alerts(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','processing','sent','cancelled','failed')),
  scheduled_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,
  error_code text,
  check (scheduled_for > created_at - interval '1 minute')
);

create unique index if not exists announcement_scheduled_sends_one_active
  on public.announcement_scheduled_sends (event_id, announcement_id)
  where status in ('scheduled','processing');

create index if not exists announcement_scheduled_sends_due
  on public.announcement_scheduled_sends (scheduled_for)
  where status = 'scheduled';

alter table public.announcement_scheduled_sends enable row level security;
revoke all on public.announcement_scheduled_sends from anon, authenticated;
