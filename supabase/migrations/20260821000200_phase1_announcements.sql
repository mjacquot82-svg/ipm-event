-- Migration form of docs/platform/phase1_announcements_migration.sql.
-- This remains idempotent after the consolidated platform schema.

alter table public.alerts
  add column if not exists created_by text not null default 'Unknown organizer';

create index if not exists alerts_event_status_priority_created_idx
  on public.alerts (event_id, status, severity, created_at desc);
