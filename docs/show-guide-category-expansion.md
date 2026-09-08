# Show Guide category expansion — pre-mutation audit

**Proposal: add 58 confirmed public sessions in five new categories; withhold nine tentative sessions. No confirmed non-attendee exclusions.** Existing 160 active records and 10 archived Landa records remain completely unchanged. Expected result: 218 active, 228 stored records.

Source: [Official Show Guide](https://www.plowingmatch.org/ipm2026/wp-content/uploads/2026/08/IPM-2026-Show-Guide.pdf); SHA-256 `299162198140ae80d3bc4a83feaa1bafe01736f7918cdfd9171aa20710860bee`. Complete timed schedule pp.36–40; supporting public-program descriptions pp.4,8–9, and repeated RAM times p.7. This extends the prior 67-candidate crosswalk without revising its historical accounting.

## Category design

Five categories are the smallest accurate expansion: arena performances, Event Centre demonstrations/competitions, the named lumberjack show, plowing competitions, and worship are distinct attendee program families.

| New category | Candidates | Add | Withhold |
|---|---:|---:|---:|
| RAM Truck Corral | 21 | 20 | 1 |
| Event Centre #1 | 16 | 9 | 7 |
| Great Canadian Lumberjack Show | 15 | 15 | 0 |
| Plowing | 14 | 13 | 1 |
| Church Service | 1 | 1 | 0 |

Naming follows printed program headings. “Event Centre #1” retains the numbered venue identity; West 2 remains its location. “Great Canadian Lumberjack Show” uses the exact program name. “Church Service” describes the program rather than creating a generic Sunday category. “Plowing” follows the printed Plowing Schedule.

Categories are non-null text on schedule rows, not a separate taxonomy table or enum. No schema migration or category metadata rows are needed. Desktop chips and the mobile selector derive all names from events and sort alphabetically with localeCompare; no explicit ordering changes. The existing neutral category style applies to the five new names (gray label/tint, accessible foreground). No category icons are required. Existing branded colors stay unchanged. Sunday is supported; the existing weekday selector places it after Saturday, while schedule sections remain chronological.

## Eligibility and source limits

- Participant qualification rules for Farmer Olympics do not prohibit attendance: p.9 explicitly invites spectators to cheer. The public guide also invites visitors to daily plowing competitions (p.4). Competitor eligibility is not a spectator restriction.
- Withhold Tuesday Gregglea at 11:00 (TBC), seven Lawn Mower Races (to be confirmed), and Tuesday VIP Plowing at approximately 14:00 (public access unconfirmed). No evidence supports declaring these definitively non-attendee events, so excluded count is zero.
- No additional entry-specific weather qualification or invitation-only restriction was found for the 58 confirmed candidates. Do not invent end times: all 58 have start times only.
- Lumberjack location is not specified by the guide. Keep location_name null rather than invent a venue or map pin; the exact show name identifies the program. Plowing uses the guide’s Plowing Fields label, with no invented coordinates or individual plot assignment. Church uses the printed CKNX venue, without inheriting its unrelated entertainment category.
- Normalize the printed Saturday “RAM Rode” typo to RAM Rodeo, corroborated by the repeated p.7 schedule. Expand “Tractors” to the clear attendee title “Tractor Plowing”; dates/times remain exact.
- Duplicate risks: repeated RAM references add nothing; different sessions of the same performer/time on different dates remain distinct; 09:30 and 11:00 tractor sessions are separately printed entries; Queen of the Furrow plowing is distinct from existing speeches. No existing record shares these new program identities.

## Exact candidate decisions

| Page | Date | Start | Title | Category | Venue | Decision |
|---|---|---|---|---|---|---|
| 36 | 2026-09-20 | 14:30 | Church Service | Church Service | CKNX Centennial Pavilion (GFO Stage) | ADD_PUBLIC_EVENT |
| 36 | 2026-09-22 | 11:00 | Gregglea Clydesdales | RAM Truck Corral | RAM Truck Corral | TENTATIVE_REQUIRES_REVIEW |
| 36 | 2026-09-22 | 14:00 | Canadian Cowgirls Precision Drill Team | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 36 | 2026-09-22 | 15:00 | Beef Farmers of Ontario, Farmer Olympics, Plowing Match Style | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 37 | 2026-09-23 | 10:30 | Gregglea Clydesdales | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 37 | 2026-09-23 | 11:00 | Canadian Cowgirls Precision Drill Team | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 37 | 2026-09-23 | 15:00 | Canadian Cowgirls Precision Drill Team | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 10:30 | Gregglea Clydesdales | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 11:00 | Canadian Cowgirls Precision Drill Team | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 12:00 | RAM Rodeo | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 14:00 | Canadian Cowgirls Precision Drill Team | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 15:00 | RAM Rodeo | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 39 | 2026-09-25 | 10:30 | Gregglea Clydesdales | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 39 | 2026-09-25 | 11:00 | Canadian Cowgirls Precision Drill Team | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 39 | 2026-09-25 | 12:00 | RAM Rodeo | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 39 | 2026-09-25 | 14:00 | Canadian Cowgirls Precision Drill Team | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 39 | 2026-09-25 | 15:00 | RAM Rodeo | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 40 | 2026-09-26 | 10:30 | Gregglea Clydesdales | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 40 | 2026-09-26 | 11:00 | Canadian Cowgirls Precision Drill Team | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 40 | 2026-09-26 | 12:00 | RAM Rodeo | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 40 | 2026-09-26 | 14:00 | Canadian Cowgirls Precision Drill Team | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 40 | 2026-09-26 | 15:00 | RAM Rodeo | RAM Truck Corral | RAM Truck Corral | ADD_PUBLIC_EVENT |
| 36 | 2026-09-22 | 09:30 | Tractor Plowing | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 36 | 2026-09-22 | 10:00 | Horse Plowing | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 36 | 2026-09-22 | 11:00 | Tractor Plowing | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 37 | 2026-09-23 | 09:30 | Tractor Plowing | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 37 | 2026-09-23 | 10:00 | Horse Plowing | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 37 | 2026-09-23 | 11:00 | Tractor Plowing | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 09:30 | Tractor Plowing | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 10:00 | Horse Plowing | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 11:00 | Tractor Plowing | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 14:30 | Queen of the Furrow Plowing Competition | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 39 | 2026-09-25 | 09:00 | Tractor Plowing | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 39 | 2026-09-25 | 09:00 | Horse Plowing | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 40 | 2026-09-26 | 08:30 | Junior Competition (tractors and horses) | Plowing | Plowing Fields | ADD_PUBLIC_EVENT |
| 36 | 2026-09-22 | 14:00 | VIP Plowing | Plowing | Plowing Fields | TENTATIVE_REQUIRES_REVIEW |
| 36 | 2026-09-22 | 10:30 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 36 | 2026-09-22 | 13:00 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 36 | 2026-09-22 | 15:00 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 37 | 2026-09-23 | 10:30 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 37 | 2026-09-23 | 13:00 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 37 | 2026-09-23 | 15:00 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 10:30 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 13:00 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 15:00 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 39 | 2026-09-25 | 10:30 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 39 | 2026-09-25 | 13:00 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 39 | 2026-09-25 | 15:00 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 40 | 2026-09-26 | 10:30 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 40 | 2026-09-26 | 13:00 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 40 | 2026-09-26 | 15:00 | Great Canadian Lumberjack Show | Great Canadian Lumberjack Show | Not specified | ADD_PUBLIC_EVENT |
| 36 | 2026-09-22 | 11:00 | Foxton Fuels Farmall Square Dancing Tractors | Event Centre #1 | Event Centre #1 — West 2 | ADD_PUBLIC_EVENT |
| 36 | 2026-09-22 | 15:30 | Lawn Mower Races | Event Centre #1 | Event Centre #1 — West 2 | TENTATIVE_REQUIRES_REVIEW |
| 37 | 2026-09-23 | 09:30 | Lawn Mower Races | Event Centre #1 | Event Centre #1 — West 2 | TENTATIVE_REQUIRES_REVIEW |
| 37 | 2026-09-23 | 12:00 | Foxton Fuels Farmall Square Dancing Tractors | Event Centre #1 | Event Centre #1 — West 2 | ADD_PUBLIC_EVENT |
| 37 | 2026-09-23 | 13:30 | Foxton Fuels Farmall Square Dancing Tractors | Event Centre #1 | Event Centre #1 — West 2 | ADD_PUBLIC_EVENT |
| 37 | 2026-09-23 | 15:30 | Lawn Mower Races | Event Centre #1 | Event Centre #1 — West 2 | TENTATIVE_REQUIRES_REVIEW |
| 38 | 2026-09-24 | 09:30 | Lawn Mower Races | Event Centre #1 | Event Centre #1 — West 2 | TENTATIVE_REQUIRES_REVIEW |
| 38 | 2026-09-24 | 10:30 | Foxton Fuels Farmall Square Dancing Tractors | Event Centre #1 | Event Centre #1 — West 2 | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 13:00 | Foxton Fuels Farmall Square Dancing Tractors | Event Centre #1 | Event Centre #1 — West 2 | ADD_PUBLIC_EVENT |
| 38 | 2026-09-24 | 15:30 | Lawn Mower Races | Event Centre #1 | Event Centre #1 — West 2 | TENTATIVE_REQUIRES_REVIEW |
| 39 | 2026-09-25 | 09:30 | Lawn Mower Races | Event Centre #1 | Event Centre #1 — West 2 | TENTATIVE_REQUIRES_REVIEW |
| 39 | 2026-09-25 | 11:30 | Foxton Fuels Farmall Square Dancing Tractors | Event Centre #1 | Event Centre #1 — West 2 | ADD_PUBLIC_EVENT |
| 39 | 2026-09-25 | 15:30 | Teeswater Agro Parts Combine Demolition Derby | Event Centre #1 | Event Centre #1 — West 2 | ADD_PUBLIC_EVENT |
| 40 | 2026-09-26 | 09:30 | Lawn Mower Races | Event Centre #1 | Event Centre #1 — West 2 | TENTATIVE_REQUIRES_REVIEW |
| 40 | 2026-09-26 | 11:30 | Foxton Fuels Farmall Square Dancing Tractors | Event Centre #1 | Event Centre #1 — West 2 | ADD_PUBLIC_EVENT |
| 40 | 2026-09-26 | 15:30 | Teeswater Agro Parts Combine Demolition Derby | Event Centre #1 | Event Centre #1 — West 2 | ADD_PUBLIC_EVENT |

No production deployment or data change is authorized here. Staging implementation uses an insert-only, snapshot-guarded transaction after local PostgreSQL and schedule validation. Stable external identities and deterministic per-event UUIDs prevent recreation on retry. All original rows, including timestamps and rich content, are checked unchanged before commit.

## Implemented and verified on staging

Added all 58 confirmed sessions: RAM Truck Corral 20, Event Centre #1 9, Great Canadian Lumberjack Show 15, Plowing 13, Church Service 1. Staging now has 218 active records and 10 archived records, across ten categories. No schema, frontend runtime, or deployment change was necessary. The nine tentative sessions remain withheld.

Validation passed:

- 65 backend/data tests, including seven real local PostgreSQL cases. Insert transaction, exact preservation, idempotency, stale-snapshot refusal, and wrong-event refusal passed.
- 33 frontend schedule/filter tests; TypeScript no-emit, Python compilation, and staging-mode local web build passed. The local build uses a placeholder public push key and is not a deployable notification configuration; no build was deployed.
- Ten real Chromium filter checks: five new categories at desktop 1440px and mobile 390px. Each rendered exactly 20/9/15/13/1 events respectively, with Sunday church visible and no page errors. These ran against the unchanged local frontend build using the freshly fetched staging API response. External requests were blocked; no staff/browser/provider state was changed. Screenshots and browser results are in the release artifacts.
- Fresh staging SQL and public API agree on every active ID, title/content, date, time, category and venue. Database null descriptions/end times retain the existing API empty-string representation. All 170 original complete database rows, including all 116 active Landa items and 10 withdrawals, are unchanged.
- Zero duplicate external IDs or active session signatures. All nine withheld identities remain absent. Production’s 151 complete schedule rows match the previous verified production snapshot.

The first staging request timed out at the transport. A successful read then established 170 original rows and zero additions before retry. The guarded retry committed successfully; no blind retry or partial schedule was accepted. The full post-write comparison independently confirmed the result.

Marc’s remaining decisions: confirm Tuesday Gregglea (11:00), the seven Lawn Mower Race slots, and the approximate Tuesday VIP Plowing time/public access before any future addition. The guide does not give a lumberjack venue, so those 15 confirmed shows have no invented location or map pin. Final production promotion requires separate authorization.

Notifications/reconciliation/cohort, Notify Everyone, vendors, booth assignments, map records, installation/onboarding code, and unrelated content were untouched. No notification was sent.
