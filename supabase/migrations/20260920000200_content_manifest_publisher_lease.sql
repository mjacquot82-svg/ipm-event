-- Singleton lease for the staging-only static content manifest publisher.
-- The publisher never writes attendee content; this table only coordinates jobs.
create table if not exists public.content_manifest_publish_leases (
  lease_key text primary key,
  owner text not null,
  lease_until timestamptz not null
);

alter table public.content_manifest_publish_leases enable row level security;
revoke all on public.content_manifest_publish_leases from anon, authenticated;
