# Controlled-target pilot binding

This release adds a one-shot binding path based on the existing production
controlled-test target. It is based directly on the deployed diagnostic backend
and does not change the app bundle, service worker, target allowlist, provider or
notification sender.

The browser sends only its existing capability header and an empty JSON body. The
server reads the configured controlled-test target internally. The service-role
RPC locks the singleton project row, requires both switches off, no pilot, zero
reconciliation metadata, event `ipm-2026`, exactly one capability-owned
registration, and exact installation-target equality. It then writes only the
pilot reference. It never accepts a registration or installation ID from the
browser and never reads or writes WonderPush.

The standalone page is:
`/api/production-controlled-target-binding.html`

On success it returns only the fixed booleans/counts required by the pilot. On
failure it returns a reason enum. A second call returns `PILOT_ALREADY_SET`.
The frontend does not request permission, initialize an SDK, read a subscription,
alter storage, or retry.

## Isolated deployment

1. Apply `supabase/migrations/20260908000100_controlled_target_binding.sql` in
   production through the secure Supabase workflow. Do not alter earlier
   migrations or production rows.
2. Deploy backend commit `CONTROLLED_BACKEND_COMMIT` from the isolated branch
   `release/production-pilot-controlled-binding-backend` using Render Manual
   Deploy → Deploy a specific commit. Preserve the existing service settings.
3. Publish only the two frontend assets from commit
   `CONTROLLED_FRONTEND_COMMIT` with the complete production manifest, preserving
   every existing asset and adding only the page and module.
4. Verify backend health, pilot count zero, both switches false, and unchanged
   diagnostics before presenting the page. No notification is authorized by
   this release.

No deployment or migration is performed by preparation of this release.
