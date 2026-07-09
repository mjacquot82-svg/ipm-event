# Supabase Content Import Tool

`tools/import_supabase_content.py` imports event schedule and vendor CSV content directly into Supabase without requiring the backend to run with `CONTENT_SOURCE=supabase`.

It is intended for initial IPM migration and future event onboarding.

## Required Environment Variables

```sh
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

Do not commit these values.

## Example Command

```sh
python tools/import_supabase_content.py \
  --event ipm-2026 \
  --schedule demo-data/schedule.csv \
  --vendors demo-data/vendors.csv
```

The `--event` value is resolved through `events.slug`. The tool never hardcodes event UUIDs.

## What It Writes

For the resolved event only:

- `schedule_items`
- `vendors`

The tool validates CSV input before deleting existing rows. If validation fails, no Supabase data is modified.

On success, it replaces only rows where:

```text
event_id = events.id for the requested event slug
```

## Schedule CSV

Required schedule fields:

```text
Start Date
Event Start
Event End
one title column
```

Accepted title columns:

```text
Name
Title
Event Title
Event Name
Activity
Program
```

Mapped fields:

```text
title -> Name/Title/Event Title/Event Name/Activity/Program
description -> Description
starts_at -> Start Date + Event Start
ends_at -> Start Date + Event End
category -> Category
latitude -> Lat
longitude -> Long
days_active -> Days_Active
location_name -> Location
source -> admin
status -> published
```

## Vendor CSV

Required vendor field:

```text
Name
```

Mapped fields:

```text
name -> Name
type -> Type
description -> Description
location -> Location
hours_of_operation -> Hours of Operation
days_of_operation -> Days of Operation
priority -> priority
source -> admin
status -> published
```

## Expected Output

Example:

```text
Resolving event slug: ipm-2026
Resolved event id: 00000000-0000-0000-0000-000000000000
Schedule validation: imported=60 skipped=0 errors=0
Vendor validation: imported=80 skipped=0 errors=0
Replacing schedule_items rows for event ipm-2026...
schedule: replaced rows for this event only; imported=60
Replacing vendors rows for event ipm-2026...
Vendors: replaced rows for this event only; imported=80
Import completed successfully.
```

## Troubleshooting

### Missing Supabase Environment

```text
ERROR: SUPABASE_URL is required
ERROR: SUPABASE_SERVICE_ROLE_KEY is required
```

Set both environment variables and rerun.

### Event Not Found

```text
ERROR: Event slug not found in Supabase events table: ipm-2026
```

Create the event row first:

```sql
insert into events (slug, name, timezone, status)
values ('ipm-2026', 'IPM 2026', 'America/Toronto', 'active')
on conflict (slug) do update set
  name = excluded.name,
  timezone = excluded.timezone,
  status = excluded.status,
  updated_at = now();
```

### Validation Failed

If the tool reports validation errors, it exits before deleting or inserting data. Correct the CSV and rerun.

### Supabase HTTP Error

Confirm:

- The schema has been applied.
- The service-role key is correct.
- The `events`, `schedule_items`, and `vendors` tables exist.
- The service-role key can insert/delete rows.

## Recommended Production Migration Workflow

1. Apply the Supabase schema:

   ```text
   docs/platform/phase1_supabase_schema.sql
   ```

2. Create the event row:

   ```text
   docs/platform/ipm_2026_event_seed.sql
   ```

3. Run the importer:

   ```sh
   export SUPABASE_URL="https://<project-ref>.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

   python tools/import_supabase_content.py \
     --event ipm-2026 \
     --schedule demo-data/schedule.csv \
     --vendors demo-data/vendors.csv
   ```

4. Verify data in Supabase:

   ```sql
   select count(*) from schedule_items
   where event_id = (select id from events where slug = 'ipm-2026')
     and status <> 'archived';

   select count(*) from vendors
   where event_id = (select id from events where slug = 'ipm-2026')
     and status <> 'archived';
   ```

5. Change Render:

   ```text
   CONTENT_SOURCE=supabase
   SUPABASE_URL=<Supabase project URL>
   SUPABASE_SERVICE_ROLE_KEY=<Supabase service role key>
   DEFAULT_EVENT_ID=ipm-2026
   ```

6. Redeploy the backend.

7. Verify:

   ```text
   /api/schedule
   /api/vendors
   Admin Schedule CRUD
   Admin Vendor CRUD
   Attendee Schedule
   Attendee Vendors
   Home "Coming Up Next"
   ```

## Rollback

Set Render back to:

```text
CONTENT_SOURCE=google_sheets
```

Then redeploy the backend. Do not delete Supabase data during rollback.
