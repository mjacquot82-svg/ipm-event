# IPM 2026 Supabase Cutover Checklist

This runbook moves production content for Schedule and Vendors from Google Sheets mode to Supabase mode without removing the Google Sheets fallback.

Do not include Supabase secrets in the repository.

## Files

- Schema: `docs/platform/phase1_supabase_schema.sql`
- Event seed: `docs/platform/ipm_2026_event_seed.sql`
- Vendor import template: `docs/platform/ipm_vendor_import_template.csv`
- Demo schedule CSV: `demo-data/schedule.csv`
- Demo vendor CSV: `demo-data/vendors.csv`

## Pre-Cutover Backups And Checks

1. Confirm the current production backend is healthy:

   ```sh
   curl -i https://ipm-backend-eoiw.onrender.com/api/schedule
   curl -i https://ipm-backend-eoiw.onrender.com/api/vendors
   ```

2. Export or copy the current Google Sheets schedule and vendors data.

3. In Supabase, confirm you are in the intended production project.

4. In Render, capture the current backend environment values before changing anything:

   ```text
   CONTENT_SOURCE
   DEFAULT_EVENT_ID
   MONGODB_URL or MONGO_URL
   DB_NAME
   CORS_ORIGINS
   CORS_ORIGIN_REGEX
   ADMIN_COOKIE_SECURE
   ```

5. Confirm you have a working organizer account with the required roles:

   ```text
   Schedule import/edit: Owner or Schedule
   Vendor create/edit/delete: Owner
   ```

## Apply Supabase Schema

Open Supabase SQL Editor and paste the full contents of:

```text
docs/platform/phase1_supabase_schema.sql
```

Run it once. The schema uses `if not exists` guards for extension, tables, and indexes, so it is safe to rerun for verification.

## Seed The IPM 2026 Event

Open Supabase SQL Editor and run:

```sql
insert into events (slug, name, timezone, status)
values ('ipm-2026', 'IPM 2026', 'America/Toronto', 'active')
on conflict (slug) do update set
  name = excluded.name,
  timezone = excluded.timezone,
  status = excluded.status,
  updated_at = now();
```

The same SQL is available in:

```text
docs/platform/ipm_2026_event_seed.sql
```

## Verify Supabase Tables And Event

Run these verification queries in Supabase SQL Editor.

```sql
select id, slug, name, timezone, status, created_at, updated_at
from events
where slug = 'ipm-2026';
```

Expected: one row.

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('events', 'schedule_items', 'vendors')
order by table_name;
```

Expected:

```text
events
schedule_items
vendors
```

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'events'
order by ordinal_position;
```

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'schedule_items'
order by ordinal_position;
```

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'vendors'
order by ordinal_position;
```

## Configure Render Backend

In the Render backend service environment, set:

```text
CONTENT_SOURCE=supabase
SUPABASE_URL=<Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service role key>
DEFAULT_EVENT_ID=ipm-2026
```

Keep existing MongoDB and auth configuration:

```text
MONGODB_URL or MONGO_URL
DB_NAME
ADMIN_SESSION_COOKIE_NAME
ADMIN_SESSION_DAYS
ADMIN_COOKIE_SECURE
CORS_ORIGINS
CORS_ORIGIN_REGEX
ADMIN_PIN
```

Deploy or restart the Render backend after saving environment changes.

## Import Schedule Through Admin UI

After Render is running with `CONTENT_SOURCE=supabase`:

1. Open the production admin portal:

   ```text
   https://theipm.ca/admin
   ```

2. Sign in as an Owner or Schedule user.

3. Open Schedule.

4. Open Import schedule.

5. Paste the full contents of:

   ```text
   demo-data/schedule.csv
   ```

6. Click Map columns.

7. Confirm these mappings:

   ```text
   Event Title -> Name
   Date -> Start Date
   Start Time -> Event Start
   End Time -> Event End
   Location -> Location
   Category -> Category
   Days Active -> Days_Active
   Description -> Description
   ```

8. Click Import.

9. Confirm the import reports the expected row count.

10. Verify Supabase schedule rows:

    ```sql
    select count(*) as schedule_count
    from schedule_items
    where event_id = (select id from events where slug = 'ipm-2026')
      and status <> 'archived';
    ```

Expected with demo data: `60`.

## Import Vendors Through Supabase

The current admin UI supports vendor create/edit/delete, but it does not include a bulk vendor CSV importer. Seed vendors directly in Supabase.

Recommended option: use Supabase Table Editor CSV import into `vendors`.

1. Get the event id:

   ```sql
   select id from events where slug = 'ipm-2026';
   ```

2. Create an import CSV using:

   ```text
   docs/platform/ipm_vendor_import_template.csv
   ```

3. For each row from `demo-data/vendors.csv`, map:

   ```text
   event_id -> the UUID from events.id for ipm-2026
   name -> Name
   type -> Type
   location -> Location
   hours_of_operation -> Hours of Operation
   days_of_operation -> Days of Operation
   priority -> priority
   description -> Description
   source -> admin
   status -> published
   ```

4. Leave optional columns blank unless known:

   ```text
   location_id
   booth
   website_url
   phone
   email
   external_id
   ```

5. Import into the `vendors` table.

6. Verify vendor rows:

   ```sql
   select count(*) as vendor_count
   from vendors
   where event_id = (select id from events where slug = 'ipm-2026')
     and status <> 'archived';
   ```

Expected with demo data: `80`.

## Public API Verification

After schedule and vendor seeding:

```sh
curl -i https://ipm-backend-eoiw.onrender.com/api/schedule
curl -i https://ipm-backend-eoiw.onrender.com/api/vendors
```

Expected:

```text
HTTP 200
schedule total_count > 0
vendors total_count > 0
IDs are Supabase UUIDs
```

## Admin Verification

Use an authenticated browser session.

Schedule:

- `GET /api/admin/schedule` returns imported rows.
- Import `demo-data/schedule.csv` again in admin and confirm it replaces schedule rows in Supabase.
- Add one test schedule event.
- Edit that test event.
- Delete that test event.
- Confirm public `/api/schedule` reflects the final state.

Vendors:

- `GET /api/admin/vendors` returns imported rows.
- Add one test vendor.
- Edit that test vendor.
- Delete that test vendor.
- Confirm public `/api/vendors` reflects the final state.

## Attendee UI Verification

Open:

```text
https://theipm.ca/schedule
https://theipm.ca/vendors
https://theipm.ca/
```

Verify:

- Attendee Schedule loads real Supabase events.
- Schedule search works.
- Schedule day filters work.
- Vendor list loads real Supabase vendors.
- Vendor search works.
- Vendor categories display correctly.
- Home Coming Up Next is populated from Supabase schedule data.

## Rollback Plan

The safest rollback is to switch the backend content source back to Google Sheets and redeploy.

In Render, set:

```text
CONTENT_SOURCE=google_sheets
```

Then redeploy or restart the backend.

Do not delete Supabase data during rollback. Leave `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in place unless there is a separate security reason to remove them.

Verify rollback:

```sh
curl -i https://ipm-backend-eoiw.onrender.com/api/schedule
curl -i https://ipm-backend-eoiw.onrender.com/api/vendors
```

Expected rollback behavior: backend reads Google Sheets again.
