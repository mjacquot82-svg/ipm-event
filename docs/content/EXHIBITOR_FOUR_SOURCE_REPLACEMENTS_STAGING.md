# September 22 source-of-truth replacements — staging only

Base staging: `d9bc953928434e5765230347e9fa1dad09977c8a`.
The four explicitly approved replacements preserve the older booth occupant's ID and existing geometry.

| Current exhibitor | Location | Preserved ID |
| --- | --- | --- |
| iLGi Canada | 1A 05 | 4f2e7b8c-17aa-5780-b8f9-3139d37341f6 |
| Chris's Barbeque and Country Style Catering | 5A 23-24 | 685b1dc4-b17c-52c2-beac-3a7e0efcae40 |
| Diesel Creek Supply Co | 4A 24 | 4d5f1aa5-31ea-558c-916a-62eaf36895a3 |
| Ecoflo - Septic Solutions | 2A 28 | ab05b77c-425e-5c91-88b9-6e935972b015 |

Catalog: **306 → 304**. Four replacements, no additions. Consolidated the existing blank iLGi ID `2b4480b3-5c43-428a-9e72-fd537d75e31e` and Chris's ID `0d60adb3-a62f-4fd3-a301-5cae288d05fe` into the preserved booth records. Removed one malformed duplicate iLGi map row at 1A 05; retained the booth geometry. Other Hydro One records remain unchanged. Tented City rows: 347 → 346.

Focused validation: 65 passing catalog, confirmed decisions, source replacement, map matching, geometry, and collision tests. The source-replacement test compares existing and resulting raw geometry and runtime footprints. All unrelated catalog and map rows compare identical against the base. Existing approved shared-booth pairs remain allowed; no new outdoor collisions.

The production frontend build uses staging configuration. Mobile search and Find on Map checks cover all four at 390 × 844 on the immutable staging preview and published staging. Final deployment evidence is recorded separately after publication. No broad audit was requested or run.

Remaining unresolved, unchanged:

- Gilligan’s Juice Bar
- Brightshores Health System - Saugeen Shores Hospital Foundation
- Bellario Café / Real Time Fun
- Doc MacCheesey / RONA
- MJ Burnt Creations, Mike’s Diecast, Hill Top Farm / WASTE MANAGEMNT
- Pronano Solutions / RONA

Only staging is authorized for publication. Main, production, backend, Supabase, and notifications are outside this change. Stop for Marc after staging verification.
