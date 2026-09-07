# Production reconciliation pilot release

Backend baseline: 52e3581fc93046aba483796536e79d5cad542e2f.
Frontend baseline: a8a2b55b24403d5f72fff5854ba5ff3697c53c51 (served build 351014).
Reconciliation source: staging a8d38000c54c4ad4b9565ec69658a410eacd6de8.
No merge of main or staging is part of this release.

## Private pilot configuration

The production migration is a pilot adaptation of the staging migration of the
same name. Use the SQL packaged with this release, not the unmodified staging SQL.
It adds one nullable `pilot_registration_id` foreign key to the private singleton
`notification_reconciliation_project` row. NULL admits nobody. There is no array,
pattern, wildcard, request override, frontend identifier, or notification-allowlist
lookup. The database function checks membership on every action, including the
pre-PATCH fence and browser confirmation, before metadata/provider work. Existing
capability ownership, event and SDK installation must agree. Production host/app/
database/event checks independently gate the HTTP endpoints.

No pilot identity is embedded in source or artifact. Through the external secure
integration, identify Marc's exact existing production registration and bind that
private reference with both switches OFF. Do not infer identity from recency, the
126-row count, or the one-target notification allowlist. Verify the binding against
Marc's capability-owned diagnostic identity privately. Report only match booleans
and count 1. If this identity cannot be established, leave the reference NULL.

`enabled=false` and `repair_enabled=false` are SQL defaults. These controls govern
only the single selected pilot; even if both become true, every other registration
is rejected before coordination metadata creation. The eligibility RPC performs no
writes. Health returns only sanitized flags/count and code revision. A public
membership check requires the existing secret capability and exposes no identity.

The frontend performs a read-only membership check before setup. Confirmed pilots
bypass legacy subscription replacement and registration/rebinding. Confirmed
non-pilots retain baseline attendee setup behavior; reconciliation performs no
subscription read, repair request or provider work for them. Membership service
failure defers setup instead of risking legacy recovery for an unidentified pilot.
Normal production SDK initialization is unchanged; this coordinator never invokes
SDK init, subscribe, unsubscribe, permission requests, or storage clearing.

## Validation and rollback

Run Python regression/integration/privacy tests and real PostgreSQL coordination
with IPM_RECONCILIATION_TEST_DSN restricted to 127.0.0.1:55439. Never use production
or staging for these tests. Validate fresh migration flags/null reference, service
role privileges, pilot/non-pilot exclusion, concurrency, rotation, lost PATCH
responses, retry limits, circuit behavior and rollback. Frontend tests cover the
coordinator, lifecycle locks, card rendering, permission/subscription failures,
offline shell and notification deep links. TypeScript and production export are
required. Preserve production SDK initialization and worker registration code.

Rollback: disable repair first, then observation; retain coordination metadata
until in-flight operations finish and unknown outcomes are resolved. Revert the
frontend/backend artifacts if required. Only then consider the explicit drop
sequence at the end of the migration. Never clear client storage or subscriptions.

## External migration and later deployment sequence

1. Reconfirm production schema absence externally and validate this release's SQL
   SHA-256. Apply the migration transactionally with both flags OFF, no pilot and
   no copied staging rows. Verify RLS/grants and zero coordination rows.
2. Privately establish the one pilot registration reference with both flags OFF;
   confirm exact ownership and event. Stop if not established.
3. Publish the isolated backend commit and deploy that exact SHA on the existing
   production Render service (rootDir backend); retain all existing environment.
   No main merge is needed. Check ordinary API behavior, CORS, original diagnostic
   endpoint, health, pilot count 1, observation false and repair false.
4. Deploy the packaged frontend artifact preserving existing production static
   assets and both temporary diagnostic files. Keep existing Netlify settings;
   do not import staging redirects, PWA-update code or scripts.
5. Verify shell/manifest/worker/API/deep-link routing and diagnostic assets.
   The production worker lifecycle is unchanged: the regenerated shell version
   must activate. Close existing app tabs/windows and reopen as necessary; do not
   clear data or unregister. Confirm the new build is active on Marc's Pixel.
6. Enable observation for the selected pilot only. Through normal app lifecycle,
   prove identity, anonymous SDK state, granted permission, current root
   subscription, strict provider subscription/OS visibility, valid comparable
   token and same application-server key. Observation may write coordination
   metadata but performs no provider PATCH. Confirm MISMATCH, no uncertain write.
7. Only after those gates pass, enable guarded repair for that one pilot. Let the
   normal app run the coordinator; no manual provider manipulation.
8. Require VERIFIED and unchanged browser subscription/permission and registration/
   installation; verify no duplicate, no outstanding retry/failure/unknown outcome.
   Rerun the unchanged production diagnostic: all four fields, overall equality,
   provider flags and exact one-target match must be true.
9. No notification is authorized by this release. The older production Send Test
   still includes filterPlatforms=Web; its separate exact-target applicability
   must be reviewed before any later separately authorized send. This port changes
   no send code, targeting configuration, allowlist or Notify Everyone behavior.

## Scope exclusions

No changes to backend/platform_services.py, notification send routes, baseline
notification repository, existing diagnostics, content, schedule, map, analytics,
organizer/auth/admin behavior, environment secrets or notification targeting.
No staging diagnostic modules/manual-repair UI, staging proxies/netlify.toml,
staging PWA updater, staging WonderPush service changes, dependency/lockfile updates,
or newer-main frontend/backend functionality are promoted.
