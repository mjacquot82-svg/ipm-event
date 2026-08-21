-- Source-controlled migration form of docs/platform/phase1_supabase_schema.sql.
-- Keep the historical reference file unchanged.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null, description text, timezone text not null default 'America/Toronto',
  status text not null default 'draft', starts_at timestamptz, ends_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  name text not null, type text, description text, latitude double precision, longitude double precision,
  metadata jsonb not null default '{}'::jsonb, status text not null default 'published', sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.schedule_items (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null, title text not null, description text,
  starts_at timestamptz, ends_at timestamptz, timezone text not null default 'America/Toronto',
  category text not null default 'Event', location_name text, latitude double precision, longitude double precision,
  days_active text, source text not null default 'admin', external_id text, status text not null default 'published',
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null, name text not null, type text, description text,
  booth text, location text, hours_of_operation text, days_of_operation text, priority integer not null default 99,
  website_url text, phone text, email text, source text not null default 'admin', external_id text,
  status text not null default 'published', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  title text not null, message text not null, severity text not null default 'info', audience text not null default 'all',
  status text not null default 'draft', published_at timestamptz, expires_at timestamptz,
  created_by text not null default 'Unknown organizer', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  schedule_item_id uuid references public.schedule_items(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null, title text not null, description text,
  starts_at timestamptz, ends_at timestamptz, timezone text not null default 'America/Toronto',
  status text not null default 'published', sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  title text not null, summary text, body text, priority integer not null default 0, status text not null default 'draft',
  published_at timestamptz, expires_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id) on delete cascade,
  key text not null, value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (event_id, key)
);

create unique index if not exists events_slug_idx on public.events (slug);
create index if not exists locations_event_status_sort_idx on public.locations (event_id, status, sort_order);
create index if not exists schedule_items_event_status_starts_at_idx on public.schedule_items (event_id, status, starts_at);
create index if not exists schedule_items_event_status_sort_idx on public.schedule_items (event_id, status, sort_order);
create index if not exists schedule_items_location_id_idx on public.schedule_items (location_id);
create index if not exists vendors_event_status_priority_idx on public.vendors (event_id, status, priority, name);
create index if not exists vendors_location_id_idx on public.vendors (location_id);
create index if not exists alerts_event_status_published_idx on public.alerts (event_id, status, published_at);
create index if not exists alerts_event_status_priority_created_idx on public.alerts (event_id, status, severity, created_at desc);
create index if not exists itinerary_items_event_status_sort_idx on public.itinerary_items (event_id, status, sort_order);
create index if not exists itinerary_items_schedule_item_id_idx on public.itinerary_items (schedule_item_id);
create index if not exists itinerary_items_location_id_idx on public.itinerary_items (location_id);
create index if not exists news_posts_event_status_published_idx on public.news_posts (event_id, status, published_at);

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at before update on public.events for each row execute function public.set_updated_at();
drop trigger if exists set_locations_updated_at on public.locations;
create trigger set_locations_updated_at before update on public.locations for each row execute function public.set_updated_at();
drop trigger if exists set_schedule_items_updated_at on public.schedule_items;
create trigger set_schedule_items_updated_at before update on public.schedule_items for each row execute function public.set_updated_at();
drop trigger if exists set_vendors_updated_at on public.vendors;
create trigger set_vendors_updated_at before update on public.vendors for each row execute function public.set_updated_at();
drop trigger if exists set_alerts_updated_at on public.alerts;
create trigger set_alerts_updated_at before update on public.alerts for each row execute function public.set_updated_at();
drop trigger if exists set_itinerary_items_updated_at on public.itinerary_items;
create trigger set_itinerary_items_updated_at before update on public.itinerary_items for each row execute function public.set_updated_at();
drop trigger if exists set_news_posts_updated_at on public.news_posts;
create trigger set_news_posts_updated_at before update on public.news_posts for each row execute function public.set_updated_at();
drop trigger if exists set_settings_updated_at on public.settings;
create trigger set_settings_updated_at before update on public.settings for each row execute function public.set_updated_at();
