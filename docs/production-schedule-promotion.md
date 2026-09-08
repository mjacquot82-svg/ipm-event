# Approved production schedule promotion — September 8, 2026

Executed one atomic production schedule transaction after the user explicitly authorized the reviewed delta and five production-field preservations. No staging row cloning or application deployment occurred.

## Approved delta and pre-write assertions

- Production before: 151 active records.
- 67 Landa field updates, 19 Landa additions, 10 Landa archives.
- 58 confirmed Show Guide additions across RAM Truck Corral, Event Centre #1, Great Canadian Lumberjack Show, Plowing, Church Service.
- Result: 218 active records, 10 archived records, 228 total.
- After preserving the five production fields: zero unexplained differences, zero lost production-only records, zero duplicates, all nine tentative sessions excluded.

Existing rows are matched by unique external identity and updated using their original production UUID. The allowed existing patches are limited to the authoritative schedule fields or archive status. All 77 new identities come from the reviewed manifests; UUIDs are deterministic within the production event. Categories are schedule text values, so no migration was required.

## Mandatory preservations

Both Ashley Grant / Soul Purpose Reiki descriptions retain the complete production wording containing “will catch you.” Michelle Knoll / The Dragonfly Spa retains “performing.” Heather Stark / Willow Home retains source=admin. The withdrawn Oil Sampling record retains its original UUID, title “Oil Sampling,” description and metadata while becoming archived. None of these five staging regressions was promoted.

## Transaction safety and independent verification

The transaction takes a schedule table write-coordination lock with a five-second lock timeout and 30-second statement timeout, checks the exact fresh production snapshot and event slug, applies only the approved updates/inserts/archives, and compares the complete resulting schedule with the expected result before COMMIT. Original creation/update timestamps and every other protected original field are checked. No schedule triggers exist in production; no other table receives writes. A changed snapshot or failed final assertion aborts the whole transaction.

The planner accepts either the original snapshot or the exact completed result; a completed-state rerun emits no updates or inserts. Local PostgreSQL testing verified idempotency and rollback of updates, additions and archives when the final assertion is deliberately failed.

Independent production read-back passed: all 116 authoritative Landa items are correct; all 58 Show Guide sessions occur exactly once; all ten withdrawals are archived; all nine tentative entries are absent; all five categories are present. All 151 existing UUIDs and external IDs, descriptions/bios/images and unrelated metadata remain preserved. Seventy-four original records remain entirely unchanged. All five explicit preservation checks passed. Staging also matches its complete pre-promotion snapshot.

Validation: 30 focused tests passed, including seven real local PostgreSQL tests; Python compilation and diff checks passed. No frontend/runtime code changed or application deployment was needed. Exact SQL, its checksum, before/after snapshots and verification results are saved in the production-schedule-promotion release artifacts.

Notifications, notification reconciliation/cohort, Notify Everyone, vendors, maps, booth assignments, and unrelated content were untouched. No notification was sent.
