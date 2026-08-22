-- Additive identity guard for safe, source-owned schedule imports.
create unique index if not exists schedule_items_event_source_external_id_uidx
  on public.schedule_items (event_id, source, external_id)
  where external_id is not null;
