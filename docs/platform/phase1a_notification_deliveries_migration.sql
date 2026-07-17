-- Webpushr Phase 1A notification delivery ledger.
-- Apply only after reviewing against the target Supabase project.

-- Required by the composite event/announcement foreign key below.
create unique index if not exists alerts_event_id_id_idx
  on public.alerts (event_id, id);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  announcement_id uuid not null,
  audience text not null check (audience in ('test', 'everyone')),
  provider text not null default 'webpushr' check (provider = 'webpushr'),
  provider_campaign_id text,
  status text not null default 'requested' check (status in ('requested', 'sent', 'failed')),
  requested_by text not null,
  requested_at timestamp with time zone not null default now(),
  sent_at timestamp with time zone,
  error_message text,
  target_url text not null,
  notification_title text not null,
  notification_message text not null,
  constraint notification_delivery_event_announcement_fk
    foreign key (event_id, announcement_id)
    references public.alerts(event_id, id)
    on delete cascade,
  constraint notification_delivery_sent_fields_check check (
    status <> 'sent' or (provider_campaign_id is not null and sent_at is not null)
  ),
  constraint notification_delivery_failed_error_check check (
    status <> 'failed' or error_message is not null
  )
);

create index if not exists notification_deliveries_event_announcement_idx
  on public.notification_deliveries (event_id, announcement_id, requested_at desc);

-- This is the concurrency guard. A failed everyone attempt can be retried,
-- while requested and sent attempts both block a second provider campaign.
create unique index if not exists notification_deliveries_one_active_everyone_idx
  on public.notification_deliveries (event_id, announcement_id)
  where audience = 'everyone' and status in ('requested', 'sent');
