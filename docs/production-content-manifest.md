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
