# DirtWorks schedule content review — September 15, 2026

Baseline: staging `4e16d853cb506000c65f3dd038c0508fc114afba`.
Branch: `content/dirtworks-schedule-20260915`.

## Audit before editing

Read-only audit of the staging API (219 published events) and all 229 staging
schedule_items, including unpublished records. Searches covered DirtWorks,
Dirt Works, Mini Ex, Mini Excavator, Track Loader, Compact Ride, Dealer Demo,
excavator and rodeo, across titles, descriptions, locations, categories and IDs.

No matching or near-matching DirtWorks event exists on September 22, 23, 24, 25
or 26. Existing title/time/category/location/source IDs for each are therefore
not applicable. Broader rodeo matches were six unrelated RAM Rodeo sessions
at RAM Truck Corral, September 24–26, noon and 3 PM. They are unchanged.
There was no DirtWorks entry in the locations table or schedule location names.

Following the established venue-based categories, all five new records use
`DirtWorks Demo Field` as category and location_name. No location entity, map
coordinates, marker, or map change is included.

## Five records prepared

All times America/Toronto, 2026. Source: `ipm_dirtworks_2026_official_graphics`.

| Date | Time | Title | External ID |
|---|---|---|---|
| Tuesday September 22 | 2–3 PM | Mini Ex Rodeo | 2026-09-22-dirtworks-mini-ex-rodeo |
| Wednesday September 23 | 2–3 PM | Track Loader Rodeo | 2026-09-23-dirtworks-track-loader-rodeo |
| Thursday September 24 | 2–3 PM | Mini Ex Rodeo | 2026-09-24-dirtworks-mini-ex-rodeo |
| Friday September 25 | noon–1 PM | Track Loader Rodeo | 2026-09-25-dirtworks-track-loader-rodeo |
| Saturday September 26 | noon–1 PM | Compact Ride & Drive | 2026-09-26-dirtworks-compact-ride-and-drive |

Five creates prepared; zero existing records updated. Dealer Demo appears in
descriptions, using only the supplied equipment demonstration information.

## Media

Originals were found under `/workspaces/ipm-event/.worktrees/grounds-no-entry/data/`
and copied unchanged into this isolated branch's data folder:

- `IMG_20260915_133702.png`: authoritative Daily Event Schedule.
- `IMG_20260915_133655.png`: dedicated DirtWorks promotional graphic (a social-story screenshot).

The promotional image is copied byte-for-byte to
`frontend/public/event-media/dirtworks-demo-field-3e899f6a3ab3.png`.
Original dimensions: 1320 × 2868. SHA-256 checksums are in the JSON manifest.
The existing EventDetailMedia component uses contain sizing, with a link to
view the original poster at full size. No cropping, image generation, UI changes,
or use of the Daily Event Schedule as event artwork.

## Local review and later rollout

This is an unapplied content package. No shared database writes or deployment.
`backend/prepare_dirtworks_schedule.py` consumes a full staging snapshot and
produces insert records offline. It is idempotent and fails closed on any new
near-match, duplicate identity, or changed existing record requiring review.
Reaudit immediately before a later approved database import.

The media URL targets staging and becomes available only after a later approved
asset deployment. Local screenshots render the actual staging-baseline app with
the prepared records supplied through a local intercepted schedule response and
the copied image served locally. All 219 existing public records are preserved
exactly in that response. Screenshots are a local content review, not evidence
that shared staging has been updated.

No Nicole implementation or map files are changed. No push is performed because
this task explicitly forbids deployment and pushing could trigger Netlify.
