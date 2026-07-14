-- Phase 1 Announcements module
-- Reuses the event-scoped alerts table and adds organizer attribution.

alter table public.alerts
  add column if not exists created_by text not null default 'Unknown organizer';

create index if not exists alerts_event_status_priority_created_idx
  on public.alerts (event_id, status, severity, created_at desc);
