# Artisan Tent staging update — 2026-09-19

Authority: Pennie Wilhelm's email requirements supplied directly by Marc, titled “ONE mistake ... Fw: UPDATE IPM APP Artisan Tent vendors/our Presenters”. No other vendor list was reinterpreted.

## Duplicate/source audit

All staging Schedule statuses (including archived) and the public feed were searched for names, spelling variants and topics. No existing occurrence of the eight requested Artisan Tent presentations was found. Ken had no existing 10:30 AM Schedule record to correct; his new occurrence uses the explicitly corrected 1:30 PM.

Existing Susan **Seitz** “Creative Circle” presentations on September 23 at 11:15 AM and September 24 at 11:30 AM are different talks at MNP venues. Their IDs, spelling, times and content remain unchanged. The new Artisan talks use **Susan Sietz**, exactly as supplied for this task.

Existing “Flossie Mae” presentations on Wednesday September 23 at 12:30 PM and 4:00 PM are at other venues. They do not resolve the conflicting Wednesday/September 25 date for Angie's Artisan presentation and remain untouched. Existing Queen of the Furrow speeches/competition are also distinct events and remain untouched.

## Applied to staging only

Eight new published occurrences, all at **Artisan Tent Presentation Area**, category **Artisan Tent Presentations**, timezone **America/Toronto**:

| Presenter | Topic | Date(s) | Local time |
|---|---|---|---|
| Susan Sietz | Wool Painting with fibre | Sep 22, 24, 25, 26 | 2:00 PM |
| Shannon Woods | Long ago Cures | Sep 23 | 1:00 PM |
| Shannon Woods | Greenock Swamp Tours | Sep 25 | 1:00 PM |
| Victoria Kolb - Queen of the Furrow | Her Experiences as Queen of the Furrow | Sep 22 | 2:30 PM |
| Ken Thornburn | Wild Side Art Gallery - my sketches | Sep 24 | 1:30 PM |

Topics are the exact event titles; presenter names appear in descriptions, which the existing Schedule searches. End times are null because no duration was provided. Deterministic UUIDs and source/external identities prevent duplicate insertion. Existing records are never updated by this patch.

`backend/prepare_artisan_presenters.py` prints a reviewable plan by default; `--sql` prints the guarded SQL, without executing it. Execute only on staging project `hooiqjcbcbwzjjvnwyxf`. It checks the staging event identity, checksums all existing Schedule rows before/after, and refuses drift or conflicting identities. No schema migration or runtime/backend change is required.

After application, database rows increased from 246 to 254 (including archived), with eight unique new IDs. The checksum of all 246 pre-existing complete rows remained `a76d129080c12590186a0fcaef2922c9`. The public feed increased from 227 to 235; every previous public event was compared field-for-field and remained identical.

## Unresolved — no changes applied

- **Artisan vendor locations:** blocked. The authoritative staging vendor source identifies the Artisan Tent as a parent-tent placeholder, not its individual exhibitors. Historical July/production snapshots contain Indoor vendors but do not establish Artisan Tent membership; treating all Indoor vendors as artisans would be a guess. Sherry Lynn's exact member list is required. No vendors were added, renamed or moved.
- **Angie Smith-Eckensweiler:** needs organizer clarification: **Wednesday September 23 OR Friday September 25 at 2:00 PM**. No new event or modification was made for Angie.

## Validation and review

- Two new backend data/identity tests passed.
- Relevant Schedule/vendor/search/itinerary tests: 116 passed, one pre-existing failure in `schedule-category-colours.test.mjs` expecting staging to contain no reminder functionality. This task changes no reminder code and does not claim a clean unrelated suite.
- Frontend production-style build passed; `git diff --check` passed.
- Fixture browser scenarios at phone/desktop widths verify all eight presenter searches, day filters, exact event details and favorite identity while preserving a pre-existing favorite. All browser mutations and provider requests are blocked.
- Live read-only checks compare the public API against the approved eight records and the complete pre-update feed. Evidence and screenshots are retained privately in `.artifacts/artisan-update/` with checksums.

Review in staging Schedule: search each presenter, select the listed day, open the talk, and verify its topic/time/Artisan location. Ken must show Thursday September 24 at 1:30 PM. Vendor updates and Angie's date require the missing organizer information.

No production, parade geometry, other vendor assignments, notification analytics, T-30 architecture or PR #39 changes.
