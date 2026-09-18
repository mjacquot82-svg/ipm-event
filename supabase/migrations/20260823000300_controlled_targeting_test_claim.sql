-- One-shot staging harness ledger. One controlled targeting test per event.
create table if not exists public.controlled_targeting_tests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  registration_id uuid not null references public.itinerary_reminder_installations(id) on delete cascade,
  status text not null check (status in ('claimed', 'sent', 'failed')),
  claimed_at timestamptz not null default now(), sent_at timestamptz,
  provider_delivery_id text, error_message text
);
alter table public.controlled_targeting_tests enable row level security;
-- Rollback: drop public.controlled_targeting_tests.
