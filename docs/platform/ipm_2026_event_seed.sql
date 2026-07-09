insert into events (slug, name, timezone, status)
values ('ipm-2026', 'IPM 2026', 'America/Toronto', 'active')
on conflict (slug) do update set
  name = excluded.name,
  timezone = excluded.timezone,
  status = excluded.status,
  updated_at = now();
