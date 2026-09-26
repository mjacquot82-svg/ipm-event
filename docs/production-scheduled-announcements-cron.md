# Production scheduled announcements cron — activation runbook

This feature uses a standalone guarded Render Cron Job. Merging/deploying the
application does not authorize automatic broadcasts. The runner refuses to
construct clients or send unless every production identity guard matches.

## Render configuration

| Setting | Value |
| --- | --- |
| Service type | Cron Job |
| Name | production-scheduled-announcements |
| Repository | https://github.com/mjacquot82-svg/ipm-event |
| Branch | main |
| Runtime | Python |
| Root directory | repository root |
| Build command | pip install -r backend/requirements.txt |
| Command | python backend/run_scheduled_announcements.py |
| Schedule | * * * * * |
| Region | Oregon |
| Compute | smallest available |

Environment:
SUPABASE_URL=https://hppboivlpqkfhhzfftuu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<production secret>
WONDERPUSH_ACCESS_TOKEN=<production secret>
DEFAULT_EVENT_ID=ipm-2026
PUBLIC_APP_URL=https://theipm.ca
SCHEDULED_ANNOUNCEMENTS_LIVE=true

Do not set SCHEDULED_ANNOUNCEMENTS_LIVE=true until the migration is applied and
a controlled test has passed. Disable/remove the cron or set the flag false as
the kill switch.

## Release order

1. Apply 20260926000100_scheduled_announcements.sql to the intended Supabase project.
2. Deploy API/UI with SCHEDULED_ANNOUNCEMENTS_LIVE absent/false.
3. Verify schedule/create/list/cancel with no due broad-send job.
4. Validate the runner using a controlled non-broadcast test path before enabling
   automatic attendee broadcasts.
5. Create exactly one Render cron service and enable the live flag only after approval.

The runner is intentionally separate from the web server and logs only aggregate
counts. Schedule times are stored as timestamptz/UTC; the admin presents
America/Toronto time.
