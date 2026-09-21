# Production content manifest rollout

This candidate gates attendee Schedule and Announcements refreshes with a
static `https://theipm.ca/content-manifest.json`. Attendee clients do not read
Supabase to check revisions. The production backend adds `content_revision` to
the existing public responses, and the publisher reconciles the static file.

The publisher must run as a Render cron job or equivalent single command:

```text
python backend/publish_content_manifest.py
```

Required publisher environment:

- `SUPABASE_URL` — the production project URL (`hppboivlpqkfhhzfftuu`).
- `SUPABASE_SERVICE_ROLE_KEY` — production service-role secret; never expose it
  to the frontend.
- `NETLIFY_AUTH_TOKEN` — a token permitted to create deploys for the production
  Netlify site.
- `NETLIFY_SITE_ID` — production site ID
  (`c64b53c9-5b39-441c-910a-dc00db77b4a5`).
- `MANIFEST_ENVIRONMENT=production` and `MANIFEST_EVENT=ipm-2026` — optional
  explicit safety guards; the publisher defaults to these values and rejects
  anything else.

Apply the Supabase migration before enabling the publisher. The safe rollout is:

1. Apply `20260921170000_production_content_revisions.sql` to production and
   verify the two `ipm-2026` revision rows exist.
2. Deploy the backend and confirm public Schedule and Announcement responses
   contain positive `content_revision` values.
3. Build and deploy the frontend static asset and revision-gated cache code.
4. Run the publisher once, then schedule it periodically (for example every
   minute) with the same production-only credentials.
5. Verify unchanged revisions produce no full content fetches and a content
   write increments only its own revision.

Rollback is to restore the prior frontend/backend deployment and leave the
revision table intact. The publisher refuses identity changes and revision
rollback, and a failed Netlify request is safe to retry because the next run
compares the attendee-visible static manifest before creating another deploy.

This candidate does not change staging, notification delivery, T-30/reminders,
vendors routing, map content, Render settings, or Supabase attendee read paths.

## Event-eve JWT hardening (PR #51, 2026-09-21)

**STOP for Marc: this validation does not authorize merge, migration, production
or staging deployment, notifications, or enabling reminders.**

- Backend content REST reads retry only HTTP 401 with JSON `code=PGRST303`
  and `message` containing `JWT issued at future` (case insensitive). GET/HEAD
  have at most three attempts with 250 ms then 500 ms asynchronous backoff.
  Arbitrary writes and other failures are not retried; exhausted failures retain
  the existing HTTPStatusError behavior. The existing 30-second per-request
  HTTPX timeout remains. Content and revision reads are bracketed by matching
  revisions so an edit during a delayed read cannot label older content as new.
- The publisher retains three read attempts, with 1 s then 2 s backoff and its
  existing 20-second request timeout. It explicitly classifies the future-JWT
  failure; unrelated 401s fail immediately. Only the existing idempotent lease
  operations explicitly opt into write retries. Netlify deployment POSTs remain
  single-attempt. Failed authoritative reads report OUT OF SYNC (exit 1) before
  any Netlify manifest mutation. Acquisition failures also report OUT OF SYNC;
  cleanup failures leave the lease to expire instead of aborting the next cycle.
- A warm client returns saved Schedule/Announcements before manifest completion.
  An unchanged revision makes zero full backend content requests. Manifest/read
  failure leaves the previous payload, revision and successful timestamp intact.
  Cache reads no longer rewrite storage merely to update cache age.
- Changed-revision refreshes validate the response revision **before** saving.
  Mismatched revisions, rollbacks, failed requests, malformed JSON and invalid
  responses never replace saved data. Later successful reads can commit the new
  revision. Manual refresh also refuses to lower the cached revision.
- Frontend full reads retain three attempts, 1.5 s apart, with the existing
  30-second timeout per attempt. Concurrent requests share one refresh per
  environment/content key. After a failed content refresh or manifest lookup,
  further calls observe a 30-second cooldown; no automatic retry loop is started.
  The next focus/reconnect/manual request after that window can retry. A cold
  client reports a load failure after exhaustion and receives no cache result
  or offline-availability claim until its first successful fetch.

Validation completed locally against the supplied PR head plus this hardening:

- Production `npm run build:web`, TypeScript `--noEmit`, scoped service ESLint:
  passed. Production public frontend configuration was used, with independent
  copied dependencies whose dependency manifests match; this was not a fresh
  lockfile install. Reproducible build output stayed in `/tmp` due to workspace
  storage constraints; source and evidence were preserved.
- Focused versioned-cache/offline/reconnect Node suites: 39 passed, including
  14 tests executing the actual TypeScript data service with injected failures.
- Backend publisher, JWT retry, revision migration, schedule and announcement
  suites: 70 passed, plus 8 subtests. Migration tests used disposable PostgreSQL
  with networking disabled; no production/staging database was accessed.
- Chromium offline map install/upgrade/cold reopen and PWA refresh/reconnect
  fixtures: passed. Providers were stubbed; no notifications were sent.
- Broader historical release-isolation suite: 4 passed, 2 failed. Both failures
  reproduce on supplied head `48f70d252a1062fddfa3d2225636fdcdb1e3e79b`:
  comparisons of Home/map files and vendor IDs use an older historical release.
  These pre-existing failures were not hidden by changing their expectations.

Remaining limitations: retries mitigate intermittent REST rejection but do not
repair Supabase's JWT validation issue. Cold devices still require one successful
content read; prolonged outages leave warm content stale and delay publication.
The extra revision guard costs one additional small REST read per full content
response. Existing network timeouts can make cold failures slow. The publisher's
existing 90-second lease is not renewed during long operations, so prolonged API
stalls/concurrent deployment activity still warrant an explicit rollout check.
No live publisher or production rollout was exercised. Marc should gate rollout
on migration/revision readiness, stable successful REST reads, publisher lease
and manifest verification, and real cold/warm smoke checks. This hardening is a
candidate for that gated review, not unconditional production clearance.
