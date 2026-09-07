# Prepared production reconciliation pilot

Backend commit: `741d51ecff5fb11e522e481e32ca02ee0430052d`
Frontend commit: `1d66efe668b08062faba1887992cdd3793c1e8ae`
Frontend artifact build: `359891`

GitHub handoff refs (exact reviewed commits):
- Backend: `release/production-pilot-backend`
- Frontend: `release/production-pilot-frontend`
- Documentation only: `release/production-pilot-handoff`

The documentation branch descends from the backend release and adds only these
handoff documents. Deploy the exact backend/frontend commits above; do not deploy
the documentation branch. The reviewed commits remain unchanged.

Preparation made no production or staging database/provider requests. All database
tests used an isolated PostgreSQL container on loopback. This handoff authorizes
no deployment, migration, observation, repair or notification.

## Backend files added/adapted

- `backend/production_reconciliation.py`
- `backend/server.py`
- `backend/subscription_material.py`
- `backend/subscription_provider.py`
- `backend/subscription_reconciliation.py`
- `docs/production-reconciliation-pilot-release.md`
- `supabase/migrations/20260907000100_subscription_reconciliation.sql`
- `tests/requirements-reconciliation.txt`
- `tests/test_production_reconciliation.py`
- `tests/test_reconciliation_postgres.py`
- `tests/test_subscription_reconciliation.py`

## Frontend files added/adapted

- `docs/production-reconciliation-pilot-release.md`
- `frontend/app/_layout.tsx`
- `frontend/public/api/production-push-compare.mjs`
- `frontend/public/api/production-push-diagnostic.html`
- `frontend/scripts/package-production-pilot.py`
- `frontend/src/components/NotificationOptIn.tsx`
- `frontend/src/services/notificationRegistration.ts`
- `frontend/src/services/notificationRegistration.web.ts`
- `frontend/src/services/subscriptionReconciliation.ts`
- `frontend/src/services/subscriptionReconciliation.web.ts`
- `frontend/src/services/subscriptionReconciliationCore.ts`
- `frontend/tests/notification-registration-retry.test.mjs`
- `frontend/tests/production-pilot-card.test.mjs`
- `frontend/tests/subscription-reconciliation-lifecycle.test.mjs`
- `frontend/tests/subscription-reconciliation.test.mjs`

## Exclusions

Every source path outside the lists above remains at its respective deployed
baseline in the release commits. Generated caches/build outputs are excluded
wholesale. No changes to WonderPush initialization/service logic,
notification send/filter/allowlist code, staging proxies, PWA updater, content,
map, schedule, analytics, organizer or admin behavior are included.

## Migration

Use `supabase/migrations/20260907000100_subscription_reconciliation.sql` from
`release/production-pilot-backend`, the
production pilot adaptation, not the unmodified staging migration with the same
filename. Its SHA-256 is:

`0706da195a4c3b337e10d2f821a20fa8065b408e9b540eabefcc648c43d86e43`

Migration application and rollback were verified only in a local disposable test
database. The SQL creates both switches OFF and the pilot reference NULL. No
production migration or metadata write has occurred. The private external pilot
binding remains required; source admits at most one reference and defaults to zero.

## Verification

108 Python tests passed, including 16 real PostgreSQL coordination tests. 52 Node
tests passed. TypeScript, Python compilation, production export, diff checks,
fresh migration defaults, permissions, rollback and Git bundle verification pass.
Five existing Python deprecation warnings remain. No unrelated baseline code was
changed to alter test results.

The frontend package preserves 77 of 79 original deployment assets byte-for-byte;
only index.html and the generated worker shell manifest/version are replaced.
The old bundle remains available for cached clients; the new entry is in the new
worker shell manifest. Both diagnostic assets, manifest and Netlify control files
are preserved. Existing push/click worker logic is unchanged.

## Remaining activation gates

The external integration must apply this exact migration and privately establish
Marc's registration with both flags OFF. Exact controlled-target equality has not
been independently proven. After later isolated deployment, confirm the new build
on the Pixel before pilot observation, then strict eligibility before repair.
Only a physical browser reread can prove preserved subscription and all-four-field
equality. No successful reconciliation or safe future send is claimed yet.

Follow DEPLOYMENT.md. The production `filterPlatforms=Web` difference remains
unchanged and requires separate review before any separately authorized test send.
No Pixel action is requested during this handoff-only stage.
