# September 4 Lifestyles reconciliation

## Audited proposal — before database mutation

All identity ambiguities are resolved by Marc: Carrick Farm Market replaces Greenock Collective; Jen Fitzgerald / Soul Journey is a separate presenter from Jen Brough. Archive those four old appearances without repurposing IDs or copying their bios to the replacements.

| Accounting | Count |
|---|---:|
| Current Lifestyles records | 107 |
| Authoritative timed items | 116 |
| Unchanged / matched existing | 30 |
| Update existing | 67 |
| Add missing | 19 |
| Withdraw / archive | 10 |
| Ambiguous | 0 |
| Unrelated schedule records preserved | 44 |

After applying the proposal: 116 active Lifestyles records, 10 archived Lifestyles records, and 44 unchanged unrelated records. Tuesday 30, Wednesday 26, Thursday 27, Friday 29, Saturday 4. No deletion or recreation of an existing identity.

## Source evidence

- [Landa’s September 4 email and attachments](https://mail.google.com/mail/#all/1a06c879d40db69a): “MNP Lifestyles Tent Stage schedule.xlsx”, 17,371 bytes, SHA-256 `ea36f44371c6105424b103621c235a4d56f8e696c2edb97c60a7b9f81a95a99f`. Exact original workbook is included in `backend/import_manifests/landa_sept4/schedule.xlsx`.
- The September 4 companion Lifestyles trifold corroborates program names and the Gina doors times. It is not the official Show Guide; the Show Guide was not used.
- [September 3 naming confirmation](https://mail.google.com/mail/#all/1a067d982f717597): Hayley Wilhelm MUA; Forest Maiden Facial & Beauty Room; Flossie Mae.
- [September 1 supplied presenter names/bios](https://mail.google.com/mail/#all/1a05f689a260cc99) and [Gina timing correction](https://mail.google.com/mail/#all/1a05cf1d2677fc17).
- Read-only live production and staging snapshots each contained 107 Lifestyles and 44 unrelated schedule rows. The production preflight matches the original audit snapshot. Source rows are matched explicitly by stable external IDs and reviewed source-cell crosswalk, not by fuzzy automatic deletion.
- Isolated lineage starts at remote main `5c76c6d4e92bf5f182a9183f104e6bdb3e181b9e`. No staging branch merge or notification release is included.

## Content, identities and deliberate corrections

- All 107 existing UUIDs/external IDs remain, including the 10 archived records. All 71 existing descriptions remain byte-for-byte in their respective database environment. Images/links embedded in descriptions remain; no image assets or other content records are touched.
- Keep category, timezone, sort order, source and map/location metadata for existing records. All current Lifestyles location_id/coordinates are null; no map records change. The admin-origin Heather Stark/Willow Home record retains its source and ID.
- Preserve richer established presenter names where the workbook uses shorthand. Keep The Beyond Wireless Stage; existing Harley’s and Quality Homes labels denote the corresponding workbook demonstration stages. Do not rename unrelated map locations.
- Hayley Wilhelm MUA remains exact in both sessions. Both Forest Maiden names become Forest Maiden Facial & Beauty Room. Both Flossie Mae entries use the September 3 confirmed name rather than Customs/Custom Hats.
- New Carrick sessions have no inherited Greenock description. The two new Soul Journey demonstrations use Jen Fitzgerald’s separately supplied description. New Functional Movement and Line Dancing reuse the same Freezer Fitness bio; the new IncREDible Light session uses its existing matching bio. Other new sessions do not receive invented descriptions.
- Friday’s old 13:45–15:15 fitness block is explicitly split by the new workbook: preserve its ID for opening Freezer Fitness 13:45–14:00; add Functional Movement 14:00–14:15, Line Dancing 14:15–14:45, and IncREDible Light 14:45–15:15.
- Preserve Neustadt’s ID while moving Friday → Wednesday; Cottage Springs Wednesday → Thursday; Macleans Thursday → Friday. These are moves, not duplicate additions.
- The new workbook separates the Inside Out Art session from Corderro sampling. Preserve D’elle’s confirmed Inside Out Art Studio name and bio; remove the old misleading combined “/ Corderro” title from that art session.
- Preserve the existing Doula Panel ID/Rachel description and restore the panel title with the three presenters identified in Landa’s September 1 email.
- Wine Ontartio is normalized to Wine Ontario using the companion flyer. Cottage Spring and Craft Elk are shorthand for existing Cottage Springs and Crafty Elk; they do not create duplicate businesses.
- No unresolved conflict remains. Explicit September 4 time/date/stage changes supersede earlier timings; explicit confirmed names and existing richer content remain. Staging’s pre-existing biography wording is preserved independently of production wording.

## Saturday September 26 (EDT)

| Time | Harley’s demonstration stage | Identity handling |
|---|---|---|
| 09:00–10:00 | Doors Open — Gina Livy (Morning) | New |
| 10:00–11:00 | Gina Livy - The Livy Method | Existing ID; move from Beyond Wireless |
| 12:30–13:30 | Doors Open — Gina Livy (Afternoon) | New |
| 13:30–14:30 | Gina Livy - The Livy Method | Existing ID; move from Beyond Wireless |

Both existing Gina descriptions retain their correct doors-open times. September 4 agrees with the September 1 afternoon correction.

## Every authoritative item and exact proposed field changes

All times below are EDT. Fields not listed remain unchanged.

| Sheet1 cell | Date / stage / time | Authoritative title | Classification | Stable external ID | Exact changes |
|---|---|---|---|---|---|
| B5 | 2026-09-22 / main / 10:00-10:15am | Start of Day Movement - Definition Fitness | MATCHED_EXISTING | 2026-09-22-foodland-b6 | Retain: Christie Thomson — Definition Fitness |
| B6 | 2026-09-22 / main / 10:15-10:50am | Aaniin Collective | UPDATE_EXISTING | 2026-09-22-foodland-b7 | ends_at: Sep 22 10:45 → Sep 22 10:50 |
| D6 | 2026-09-22 / harleys / 10:15-11:15am | DK Salon | MATCHED_EXISTING | 2026-09-22-harleys-c7 | Retain: DK Salon |
| F6 | 2026-09-22 / quality / 10:15-11:15am | Bombshell Salon - Head spa | UPDATE_EXISTING | 2026-09-22-quality-homes-d7 | title: Bombshell → Bombshell Salon - Head spa |
| B7 | 2026-09-22 / main / 10:50-11:20am | Davishill Nursery | UPDATE_EXISTING | 2026-09-22-foodland-b9 | starts_at: Sep 22 10:45 → Sep 22 10:50; ends_at: Sep 22 11:15 → Sep 22 11:20 |
| D7 | 2026-09-22 / harleys / 11:15-11:45am | Sour Dough Sampling - The Bread Barn | UPDATE_EXISTING | 2026-09-22-harleys-c11 | title: Sourdough Sampling → Sour Dough Sampling - The Bread Barn |
| F7 | 2026-09-22 / quality / 11:30-12:00pm | Davishill Nursery | UPDATE_EXISTING | 2026-09-22-quality-homes-d12 | title: Davishill → Davishill Nursery |
| B8 | 2026-09-22 / main / 11:25-11:45am | Sleepers Bed Gallery | UPDATE_EXISTING | 2026-09-22-foodland-b11 | starts_at: Sep 22 11:15 → Sep 22 11:25 |
| D8 | 2026-09-22 / harleys / 11:45-12:30pm | Ionic Foot Bath - Soul Journey | ADD_MISSING | sept4-2026-09-22-harleys-d8 | New: Ionic Foot Bath — Jen Fitzgerald, Soul Journey |
| F8 | 2026-09-22 / quality / 12:00-1:00pm | SheWolf Reiki - Jenna Lethbridge | MATCHED_EXISTING | 2026-09-22-quality-homes-d14 | Retain: Jenna Lee Lethbridge — SheWolf Reiki |
| B9 | 2026-09-22 / main / 12:00-12:30pm | Carrick Farm Market | ADD_MISSING | sept4-2026-09-22-main-b9 | New: Carrick Farm Market |
| D9 | 2026-09-22 / harleys / 12:30-1:15pm | Carrick Farm Market - Sampling | ADD_MISSING | sept4-2026-09-22-harleys-d9 | New: Carrick Farm Market - Sampling |
| F9 | 2026-09-22 / quality / 1:00-2:00pm | Make Up Artist - Hayley Wilhelm | MATCHED_EXISTING | 2026-09-22-quality-homes-d18 | Retain: Hayley Wilhelm MUA |
| B10 | 2026-09-22 / main / 12:30-1:00pm | Harley's Pub and Perk - Charcuterie | UPDATE_EXISTING | 2026-09-22-foodland-b16 | title: Harley's Charcuterie → Harley's Pub and Perk - Charcuterie |
| D10 | 2026-09-22 / harleys / 1:15-1:45pm | Harley's Pub and Perk - Charcuterie Sampling | UPDATE_EXISTING | 2026-09-22-harleys-c19 | title: Charcuterie Sampling Harley's → Harley's Pub and Perk - Charcuterie Sampling |
| F10 | 2026-09-22 / quality / 2:00-3:00pm | All Bodies Pilates Demo | MATCHED_EXISTING | 2026-09-22-quality-homes-d22 | Retain: Chelsea Spackman — All Bodies Studios |
| B11 | 2026-09-22 / main / 1:00-1:30pm | Liesemer Home Hardware - Meat Smoking | UPDATE_EXISTING | 2026-09-22-foodland-b18 | title: Meat smoking → Liesemer Home Hardware - Meat Smoking |
| D11 | 2026-09-22 / harleys / 1:45-2:15pm | Liesemer Home Hardware - Sampling smoked meats | UPDATE_EXISTING | 2026-09-22-harleys-c21 | title: Liesmers Meat Sampling → Liesemer Home Hardware - Sampling smoked meats |
| F11 | 2026-09-22 / quality / 3:00-4:00pm | Indian Head Massage - Soul Journey | ADD_MISSING | sept4-2026-09-22-quality-f11 | New: Indian Head Massage — Jen Fitzgerald, Soul Journey |
| B12 | 2026-09-22 / main / 1:45-2:15pm | Photography Beitz Studios | UPDATE_EXISTING | 2026-09-22-foodland-b21 | title: Photography Bietz Studio → Photography Beitz Studios |
| D12 | 2026-09-22 / harleys / 2:15-2:45pm | GG Sips | MATCHED_EXISTING | 2026-09-22-harleys-c23 | Retain: GG Sips |
| F12 | 2026-09-22 / quality / 4:00-4:30pm | Shroom Soda - West Shore | UPDATE_EXISTING | 2026-09-22-quality-homes-d30 | title: Shroom Soda → Shroom Soda - West Shore |
| B13 | 2026-09-22 / main / 2:15-2:45pm | Make Up Artist - Hayley Wilhelm | MATCHED_EXISTING | 2026-09-22-foodland-b23 | Retain: Hayley Wilhelm MUA |
| D13 | 2026-09-22 / harleys / 3:00-4:00pm | Wine Ontartio | ADD_MISSING | sept4-2026-09-22-harleys-d13 | New: Wine Ontario |
| B14 | 2026-09-22 / main / 2:45-3:10pm | West Shore Clothing and Surf Shop | UPDATE_EXISTING | 2026-09-22-foodland-b25 | ends_at: Sep 22 15:15 → Sep 22 15:10 |
| D14 | 2026-09-22 / harleys / 4:00-5:00pm | Thornbury Craft Co. Cider and Brew House | UPDATE_EXISTING | 2026-09-22-harleys-c30 | title: Thornbury Cidery → Thornbury Craft Co. Cider and Brew House |
| B15 | 2026-09-22 / main / 3:10-3:15pm | Makeover Reveal! | ADD_MISSING | sept4-2026-09-22-main-b15 | New: Makeover Reveal! |
| B16 | 2026-09-22 / main / 3:30-4:00pm | The Space Between with Alicia | UPDATE_EXISTING | 2026-09-22-foodland-b28 | title: Wellness → The Space Between with Alicia |
| B17 | 2026-09-22 / main / 4:00-4:30pm | The Nature Babe | UPDATE_EXISTING | 2026-09-22-foodland-b30 | title: Nature Babes → The Nature Babe |
| B18 | 2026-09-22 / main / 4:30-5:00pm | The Womb - Bruce County | MATCHED_EXISTING | 2026-09-22-foodland-b32 | Retain: Jessica Connor & Rebecca Grubb — The WOMB Bruce County |
| B21 | 2026-09-23 / main / 10:00-10:15am | Start of Day Movement - Freezer Fitness | UPDATE_EXISTING | 2026-09-23-foodland-e6 | title: Start of Day Movement → Start of Day Movement - Freezer Fitness |
| B22 | 2026-09-23 / main / 10:15-10:45am | Essential Wellness | MATCHED_EXISTING | 2026-09-23-foodland-e7 | Retain: Liza Weltz — Essential Wellness |
| D22 | 2026-09-23 / harleys / 10:15-11:00am | Wood Working Demo - Mark Grubb | UPDATE_EXISTING | 2026-09-23-harleys-f7 | title: Wood Working → Wood Working Demo - Mark Grubb |
| F22 | 2026-09-23 / quality / 11:00-11:45am | Essential Wellness | MATCHED_EXISTING | 2026-09-23-quality-homes-g10 | Retain: Liza Weltz — Essential Wellness |
| B23 | 2026-09-23 / main / 10:45-11:15am | Doula Panel | UPDATE_EXISTING | 2026-09-23-foodland-e9 | title: Rachel Stroeder — Evergreen Connections → Doula Panel — Rachel Stroeder, Katie Franklin & Madison Kittel |
| D23 | 2026-09-23 / harleys / 11:00-11:45am | Mary Kay - Cheryl McNair | MATCHED_EXISTING | 2026-09-23-harleys-f10 | Retain: Mary Kay (Cheryl McNair) |
| F23 | 2026-09-23 / quality / 11:45-12:30pm | Labour of Love - Cupcake Decorating | UPDATE_EXISTING | 2026-09-23-quality-homes-g13 | title: Cupcake decorating → Labour of Love - Cupcake Decorating |
| B24 | 2026-09-23 / main / 11:15-11:45am | Susan Seitz Art Studio | UPDATE_EXISTING | 2026-09-23-foodland-e12 | starts_at: Sep 23 11:30 → Sep 23 11:15 |
| D24 | 2026-09-23 / harleys / 11:45-12:30pm | Reiki Master - Rachel Stroeder | UPDATE_EXISTING | 2026-09-23-harleys-f13 | title: Rachel Stroeder — Evergreen Connections → Reiki Master — Rachel Stroeder, Evergreen Connections |
| F24 | 2026-09-23 / quality / 2:00-3:00pm | Bombshell Salon - Head spa | UPDATE_EXISTING | 2026-09-23-quality-homes-g22 | title: Bombshell → Bombshell Salon - Head spa |
| B25 | 2026-09-23 / main / 12:00-12:30pm | Energy in the Home | MATCHED_EXISTING | 2026-09-23-foodland-e14 | Retain: The Maven Project — Ruth Montgomery |
| D25 | 2026-09-23 / harleys / 12:30-1:30pm | Flossie Mae Customs | UPDATE_EXISTING | 2026-09-23-harleys-f16 | title: Flossie Mae Custom Hats → Flossie Mae |
| F25 | 2026-09-23 / quality / 3:15-4:00pm | Neustadt Brewery | UPDATE_EXISTING | 2026-09-25-quality-homes-m27 | starts_at: Sep 25 15:15 → Sep 23 15:15; ends_at: Sep 25 16:00 → Sep 23 16:00; days_active: Friday → Wednesday |
| B26 | 2026-09-23 / main / 12:30-1:00pm | Clean Smarter, not harder. Discover Enjo | MATCHED_EXISTING | 2026-09-23-foodland-e16 | Retain: Laurie Convay, ENJO Canada |
| D26 | 2026-09-23 / harleys / 1:45-2:30pm | Simply Potts by Lauriss | UPDATE_EXISTING | 2026-09-23-harleys-f21 | title: Simply Potts → Simply Potts by Lauriss |
| F26 | 2026-09-23 / quality / 4:00-5:00pm | Grey Matter Beer Company | UPDATE_EXISTING | 2026-09-23-quality-homes-g30 | title: Grey Matter → Grey Matter Beer Company |
| B27 | 2026-09-23 / main / 1:00-1:30pm | Upstaged Design | MATCHED_EXISTING | 2026-09-23-foodland-e18 | Retain: Angela Wainscott, Upstaged Design |
| D27 | 2026-09-23 / harleys / 2:30-3:00pm | Willow Home | UPDATE_EXISTING | 2026-09-23-harleys-f24 | title: Willow Home Painting → Willow Home |
| B28 | 2026-09-23 / main / 1:45-2:30pm | Willow Home - Furniture Refresh | MATCHED_EXISTING | 2026-09-23-foodland-e21 | Retain: Heather Stark, Willow Home |
| D28 | 2026-09-23 / harleys / 3:00-4:00pm | Cody's Egg Shack | MATCHED_EXISTING | 2026-09-23-harleys-f26 | Retain: Cody's Egg Shack |
| B29 | 2026-09-23 / main / 2:30-3:00pm | Cody's Egg Shack | MATCHED_EXISTING | 2026-09-23-foodland-e24 | Retain: Cody's Egg Shack |
| B30 | 2026-09-23 / main / 3:00-3:30pm | Lake Huron Home | MATCHED_EXISTING | 2026-09-23-foodland-e26 | Retain: Sadie Al, Lake Huron Home |
| B31 | 2026-09-23 / main / 3:30-4:00pm | J&H Women's Fashions | UPDATE_EXISTING | 2026-09-23-foodland-e28 | title: J and H Womens’ Fashions → J&H Women's Fashions |
| B32 | 2026-09-23 / main / 4:00-4:30pm | Flossie Mae | UPDATE_EXISTING | 2026-09-23-foodland-e30 | title: Flossie Mae Custom Hats → Flossie Mae |
| B33 | 2026-09-23 / main / 4:30-4:55pm | Mary Kay | UPDATE_EXISTING | 2026-09-23-foodland-e32 | ends_at: Sep 23 17:00 → Sep 23 16:55 |
| B34 | 2026-09-23 / main / 4:55-5:00pm | Makeover Reveal! | ADD_MISSING | sept4-2026-09-23-main-b34 | New: Makeover Reveal! |
| B37 | 2026-09-24 / main / 10:00-10:15am | Start of Day Movement - Definition Fitness | MATCHED_EXISTING | 2026-09-24-foodland-h6 | Retain: Christie Thomson — Definition Fitness |
| B38 | 2026-09-24 / main / 10:15-10:45am | Pure Elegance Bridal | MATCHED_EXISTING | 2026-09-24-foodland-h7 | Retain: Pure Elegance Bridal |
| D38 | 2026-09-24 / harleys / 10:15-11:00am | Country Garden Greenhouse - Christmas Urns | UPDATE_EXISTING | 2026-09-24-harleys-i7 | title: Christmas Urns → Country Garden Greenhouse - Christmas Urns |
| F38 | 2026-09-24 / quality / 10:15-11:15am | Bombshell Salon - Head spa | UPDATE_EXISTING | 2026-09-24-quality-homes-j7 | title: Bombshell → Bombshell Salon - Head spa |
| B39 | 2026-09-24 / main / 10:45-11:15am | His Style | MATCHED_EXISTING | 2026-09-24-foodland-h9 | Retain: His Style |
| D39 | 2026-09-24 / harleys / 11:30-12:00pm | Susan Seitz Art Studio | MATCHED_EXISTING | 2026-09-24-harleys-i12 | Retain: Susan Seitz — Susan Seitz Studio \| Creative Circle |
| F39 | 2026-09-24 / quality / 11:30-12:00pm | The Guest House - Replanting House Plants | UPDATE_EXISTING | 2026-09-24-quality-homes-j12 | title: Replanting house plants → The Guest House - Replanting House Plants |
| B40 | 2026-09-24 / main / 11:15-11:40am | Elgin Jewelers | UPDATE_EXISTING | 2026-09-24-foodland-h11 | ends_at: Sep 24 11:45 → Sep 24 11:40 |
| D40 | 2026-09-24 / harleys / 12:30-1:15pm | Doterra with Jodi | UPDATE_EXISTING | 2026-09-24-harleys-i16 | title: Doterra w Jodi → Doterra with Jodi |
| F40 | 2026-09-24 / quality / 12:00-12:45pm | LaDel's Café - The Guest House - Cold Brew Sampling | UPDATE_EXISTING | 2026-09-24-quality-homes-j14 | title: Sampling cold brew → LaDel's Café - The Guest House - Cold Brew Sampling |
| B41 | 2026-09-24 / main / 11:40-11:45am | Makeover Reveal! | ADD_MISSING | sept4-2026-09-24-main-b41 | New: Makeover Reveal! |
| D41 | 2026-09-24 / harleys / 1:45-2:30pm | Soul Purpose Reiki - Ashley Grant | MATCHED_EXISTING | 2026-09-24-harleys-i21 | Retain: Ashley Grant — Soul Purpose Reiki |
| F41 | 2026-09-24 / quality / 1:15-2:45pm | Inside Out Art School - D'elle Calhoun | UPDATE_EXISTING | 2026-09-24-quality-homes-j19 | title: D'elle Calhoun — Inside Out Art Studio / Corderro → D’elle Calhoun — Inside Out Art Studio |
| B42 | 2026-09-24 / main / 12:00-12:30pm | Naturally Well by Hannah | MATCHED_EXISTING | 2026-09-24-foodland-h14 | Retain: Hannah Greig — Naturally Well by Hannah |
| D42 | 2026-09-24 / harleys / 2:30-3:15pm | Mary Kay - Cheryl McNair | MATCHED_EXISTING | 2026-09-24-harleys-i24 | Retain: Mary Kay (Cheryl McNair) |
| F42 | 2026-09-24 / quality / 2:45-3:30pm | Corderro - Lamb Sampling | UPDATE_EXISTING | 2026-09-24-quality-homes-j25 | title: Lamb Stick Sampling → Corderro - Lamb Sampling |
| B43 | 2026-09-24 / main / 12:30-1:00pm | Re:mind Spa & Apothecary | ADD_MISSING | sept4-2026-09-24-main-b43 | New: Re:mind Spa & Apothecary |
| D43 | 2026-09-24 / harleys / 3:15-4:00pm | Mixology | ADD_MISSING | sept4-2026-09-24-harleys-d43 | New: Mixology |
| F43 | 2026-09-24 / quality / 3:30-4:15pm | Junction 56 Distillery | UPDATE_EXISTING | 2026-09-24-quality-homes-j28 | title: Junction 56 → Junction 56 Distillery |
| B44 | 2026-09-24 / main / 1:00-1:30pm | Soul Purpose Reiki | MATCHED_EXISTING | 2026-09-24-foodland-h18 | Retain: Ashley Grant — Soul Purpose Reiki |
| D44 | 2026-09-24 / harleys / 4:00-5:00pm | Essentially Lavender | UPDATE_EXISTING | 2026-09-24-harleys-i31 | starts_at: Sep 24 16:15 → Sep 24 16:00 |
| F44 | 2026-09-24 / quality / 4:15-5:00pm | Cottage Spring | UPDATE_EXISTING | 2026-09-23-quality-homes-g27 | starts_at: Sep 23 15:15 → Sep 24 16:15; ends_at: Sep 23 16:00 → Sep 24 17:00; days_active: Wednesday → Thursday |
| B45 | 2026-09-24 / main / 1:30-2:15pm | The Feeling of Home - Designing Beyond the Trend - Panel Discussion | UPDATE_EXISTING | 2026-09-24-foodland-h20 | title: The Feeling of Home - Designing Beyond the Trend → The Feeling of Home - Designing Beyond the Trend - Panel Discussion |
| B46 | 2026-09-24 / main / 2:15-2:45pm | The Maven Project | UPDATE_EXISTING | 2026-09-24-foodland-h23 | title: Ruth Montgomery (organization) → The Maven Project — Ruth Montgomery |
| B47 | 2026-09-24 / main / 2:45-3:30pm | Essentially Lavender | UPDATE_EXISTING | 2026-09-24-foodland-h27 | starts_at: Sep 24 15:15 → Sep 24 14:45 |
| B48 | 2026-09-24 / main / 3:30-4:15pm | MNP Panel Discussion: Planning for a Successful Transition | UPDATE_EXISTING | 2026-09-24-foodland-h28 | title: MNP Succession Planning → MNP Panel Discussion: Planning for a Successful Transition |
| B49 | 2026-09-24 / main / 4:15-5:00pm | Carrick Farm Market - All things Canning | ADD_MISSING | sept4-2026-09-24-main-b49 | New: Carrick Farm Market - All things Canning |
| B53 | 2026-09-25 / main / 10:00-10:15am | Start of Day Movement - Freezer Fitness | UPDATE_EXISTING | 2026-09-25-foodland-k6 | title: Start of Day Movement → Start of Day Movement - Freezer Fitness |
| B54 | 2026-09-25 / main / 10:15-10:45am | Fire Cider & Honey - Homesteading | UPDATE_EXISTING | 2026-09-25-foodland-k7 | title: Food and Drink → Fire Cider & Honey - Homesteading |
| D54 | 2026-09-25 / harleys / 10:15-11:00am | Simply Potts by Lauriss | ADD_MISSING | sept4-2026-09-25-harleys-d54 | New: Simply Potts by Lauriss |
| F54 | 2026-09-25 / quality / 10:15-11:00am | Coastal Coffee | UPDATE_EXISTING | 2026-09-25-quality-homes-m7 | title: Costal Coffee → Coastal Coffee |
| B55 | 2026-09-25 / main / 10:45-11:15am | Harley's Pub and Perk - Meal Prep | UPDATE_EXISTING | 2026-09-25-foodland-k9 | title: Harley's Pub and Perk → Harley's Pub and Perk - Meal Prep |
| D55 | 2026-09-25 / harleys / 11:00-11:45am | Re:mind Wellness - Sara Porter | ADD_MISSING | sept4-2026-09-25-harleys-d55 | New: Sara Porter — Re:mind Wellness Spa & Apothecary |
| F55 | 2026-09-25 / quality / 11:00-11:30am | All Things Honey | MATCHED_EXISTING | 2026-09-25-quality-homes-m10 | Retain: All things honey -Jody |
| B56 | 2026-09-25 / main / 11:15-12:00pm | Hormones and Food - Jennifer Dunsmoor | UPDATE_EXISTING | 2026-09-25-foodland-k11 | title: Hormones and Food → Hormones and Food - Jennifer Dunsmoor |
| D56 | 2026-09-25 / harleys / 12:30-1:15pm | Dragonfly Spa - Michelle Knoll | MATCHED_EXISTING | 2026-09-25-harleys-l16 | Retain: Michelle Knoll — The Dragonfly Spa |
| F56 | 2026-09-25 / quality / 11:30-12:15pm | Harley's Pub and Perk - Sampling | UPDATE_EXISTING | 2026-09-25-quality-homes-m12 | title: Harley's Sampling → Harley's Pub and Perk - Sampling |
| B57 | 2026-09-25 / main / 12:00-12:30pm | Forest Maiden Facial & Beauty Room | UPDATE_EXISTING | 2026-09-25-foodland-k14 | title: Forest Maiden Facial and Beauty Room → Forest Maiden Facial & Beauty Room |
| D57 | 2026-09-25 / harleys / 1:15-2:00pm | Fire Cider & Honey - Homesteading | UPDATE_EXISTING | 2026-09-25-harleys-l19 | title: Fire Cider & Honey Sampling → Fire Cider & Honey - Homesteading |
| F57 | 2026-09-25 / quality / 12:15-1:15pm | Flowers by Uss - The Perfect Christmas Tree | UPDATE_EXISTING | 2026-09-25-quality-homes-m15 | title: The perfect Christmas Trees → Flowers by Uss - The Perfect Christmas Tree |
| B58 | 2026-09-25 / main / 12:30-1:00pm | by Grace Boutique | UPDATE_EXISTING | 2026-09-25-foodland-k16 | title: By Grace Boutique → by Grace Boutique |
| D58 | 2026-09-25 / harleys / 2:00-3:15pm | Re:mind Wellness - Organic Facial - Sara Porter | UPDATE_EXISTING | 2026-09-25-harleys-l22 | title: Sara Porter — Re:mind Wellness Spa & Apothecary → Organic Facial — Sara Porter, Re:mind Wellness Spa & Apothecary |
| F58 | 2026-09-25 / quality / 1:30-2:00pm | The Farmhouse Shop | UPDATE_EXISTING | 2026-09-25-quality-homes-m20 | title: Kerri @ The Farmhouse → The Farmhouse Shop |
| B59 | 2026-09-25 / main / 1:00-1:25pm | His Style | UPDATE_EXISTING | 2026-09-25-foodland-k18 | ends_at: Sep 25 13:30 → Sep 25 13:25 |
| D59 | 2026-09-25 / harleys / 3:15-4:00pm | IncREDible Light - Connor Fischer | MATCHED_EXISTING | 2026-09-25-harleys-l27 | Retain: Connor Fischer — IncREDible Light |
| F59 | 2026-09-25 / quality / 2:15-3:15pm | Forest Maiden Facial and Beauty Room | UPDATE_EXISTING | 2026-09-25-quality-homes-m23 | title: Forest Maiden Facial and Beauty Room → Forest Maiden Facial & Beauty Room |
| B60 | 2026-09-25 / main / 1:25-1:30pm | Makeover Reveal! | ADD_MISSING | sept4-2026-09-25-main-b60 | New: Makeover Reveal! |
| F60 | 2026-09-25 / quality / 3:15-4:00pm | Macleans Beer | UPDATE_EXISTING | 2026-09-24-quality-homes-j31 | title: Macleans → Macleans Beer; starts_at: Sep 24 16:15 → Sep 25 15:15; ends_at: Sep 24 17:00 → Sep 25 16:00; days_active: Thursday → Friday |
| B61 | 2026-09-25 / main / 1:45-2:00pm | Freezer Fitness | UPDATE_EXISTING | 2026-09-25-foodland-k21 | ends_at: Sep 25 15:15 → Sep 25 14:00 |
| F61 | 2026-09-25 / quality / 4:00-5:00pm | Craft Elk | MATCHED_EXISTING | 2026-09-25-quality-homes-m30 | Retain: Crafty Elk |
| B62 | 2026-09-25 / main / 2:00-2:15pm | Functional Movement - Freezer Fitness | ADD_MISSING | sept4-2026-09-25-main-b62 | New: Functional Movement — Freezer Fitness |
| B63 | 2026-09-25 / main / 2:15-2:45pm | Line Dancing - Freezer Fitness | ADD_MISSING | sept4-2026-09-25-main-b63 | New: Line Dancing — Freezer Fitness |
| B64 | 2026-09-25 / main / 2:45-3:15pm | IncREDible Light | ADD_MISSING | sept4-2026-09-25-main-b64 | New: Connor Fischer — IncREDible Light |
| B65 | 2026-09-25 / main / 3:30-4:15pm | MNP Panel Discussion: Navigating the Succession Journey | UPDATE_EXISTING | 2026-09-25-foodland-k28 | title: MNP Succession Planning → MNP Panel Discussion: Navigating the Succession Journey |
| B66 | 2026-09-25 / main / 4:15-4:45pm | Carrie Lynn Floral + Event Styling | UPDATE_EXISTING | 2026-09-25-foodland-k31 | title: Home and Garden → Carrie Lynn Floral + Event Styling |
| B67 | 2026-09-25 / main / 4:45-5:30pm | UpStaged Design | UPDATE_EXISTING | 2026-09-25-foodland-k33 | title: Angela - Up stage Design → Angela Wainscott, Upstaged Design |
| D70 | 2026-09-26 / harleys / 9:00-10:00am | Doors Open | ADD_MISSING | sept4-2026-09-26-harleys-d70 | New: Doors Open — Gina Livy (Morning) |
| D71 | 2026-09-26 / harleys / 10:00-11:00am | Gina Livy - The Livy Method | UPDATE_EXISTING | 2026-09-26-foodland-o8 | title: GINA LIVY → Gina Livy - The Livy Method; location_name: The Beyond Wireless Stage → Harley's Pub & Perk - Stage |
| D72 | 2026-09-26 / harleys / 12:30-1:30pm | Doors Open | ADD_MISSING | sept4-2026-09-26-harleys-d72 | New: Doors Open — Gina Livy (Afternoon) |
| D73 | 2026-09-26 / harleys / 1:30-2:30pm | Gina Livy - The Livy Method | UPDATE_EXISTING | 2026-09-26-foodland-o18 | title: GINA LIVY → Gina Livy - The Livy Method; location_name: The Beyond Wireless Stage → Harley's Pub & Perk - Stage |

## Withdrawn records — retained, not deleted

All are positively identified as current Lifestyles records and absent/superseded across the complete new package. Greenock and Jen Brough replacement handling is expressly directed by Marc. The other six absent records have no matching moved appearance.

| Existing external ID | Current title / identifying description | Current time | Stage | Action |
|---|---|---|---|---|
| 2026-09-22-foodland-b14 | Food and Drink — Greenock Collective | Sep 22 12:00–Sep 22 12:30 | The Beyond Wireless Stage | status → archived; all other content retained |
| 2026-09-22-harleys-c16 | James Greenock Collective Sampling | Sep 22 12:30–Sep 22 13:15 | Harley's Pub & Perk - Stage | status → archived; all other content retained |
| 2026-09-22-harleys-c26 | 3 Sheets | Sep 22 15:00–Sep 22 16:00 | Harley's Pub & Perk - Stage | status → archived; all other content retained |
| 2026-09-22-quality-homes-d26 | Jen Brough | Sep 22 15:00–Sep 22 16:00 | Quality Homes - Stage | status → archived; all other content retained |
| 2026-09-23-quality-homes-g16 | Bailey Donnelly — Redefined Smile featuring Airway Studio | Sep 23 12:30–Sep 23 13:30 | Quality Homes - Stage | status → archived; all other content retained |
| 2026-09-23-harleys-f30 | Formosa Spring Brewery | Sep 23 16:00–Sep 23 17:00 | Harley's Pub & Perk - Stage | status → archived; all other content retained |
| 2026-09-24-foodland-h16 | Tobermory Hyperbaric Chamber | Sep 24 12:30–Sep 24 13:00 | The Beyond Wireless Stage | status → archived; all other content retained |
| 2026-09-24-foodland-h25 | Food and Drink — Southampton Olive Oil | Sep 24 14:45–Sep 24 15:15 | The Beyond Wireless Stage | status → archived; all other content retained |
| 2026-09-24-harleys-i27 | Oil Sampling | Sep 24 15:15–Sep 24 16:00 | Harley's Pub & Perk - Stage | status → archived; all other content retained |
| 2026-09-24-foodland-h31 | All things canning — Greenock Collective | Sep 24 16:15–Sep 24 17:00 | The Beyond Wireless Stage | status → archived; all other content retained |

## Current-record accounting

| Current external ID | Current title | Classification | September 4 cell |
|---|---|---|---|
| 2026-09-22-foodland-b6 | Christie Thomson — Definition Fitness | UNCHANGED | B5 |
| 2026-09-22-harleys-c7 | DK Salon | UNCHANGED | D6 |
| 2026-09-22-quality-homes-d7 | Bombshell | UPDATE | F6 |
| 2026-09-22-foodland-b7 | Aaniin Collective (Hannah Wheeler) | UPDATE | B6 |
| 2026-09-22-foodland-b9 | Davishill Nursery | UPDATE | B7 |
| 2026-09-22-harleys-c11 | Sourdough Sampling | UPDATE | D7 |
| 2026-09-22-foodland-b11 | Sleepers Bed Gallery (Sadie Al) | UPDATE | B8 |
| 2026-09-22-quality-homes-d12 | Davishill | UPDATE | F7 |
| 2026-09-22-quality-homes-d14 | Jenna Lee Lethbridge — SheWolf Reiki | UNCHANGED | F8 |
| 2026-09-22-foodland-b14 | Food and Drink | REMOVE (archive) | — |
| 2026-09-22-harleys-c16 | James Greenock Collective Sampling | REMOVE (archive) | — |
| 2026-09-22-foodland-b16 | Harley's Charcuterie | UPDATE | B10 |
| 2026-09-22-quality-homes-d18 | Hayley Wilhelm MUA | UNCHANGED | F9 |
| 2026-09-22-foodland-b18 | Meat smoking | UPDATE | B11 |
| 2026-09-22-harleys-c19 | Charcuterie Sampling Harley's | UPDATE | D10 |
| 2026-09-22-harleys-c21 | Liesmers Meat Sampling | UPDATE | D11 |
| 2026-09-22-foodland-b21 | Photography Bietz Studio | UPDATE | B12 |
| 2026-09-22-quality-homes-d22 | Chelsea Spackman — All Bodies Studios | UNCHANGED | F10 |
| 2026-09-22-harleys-c23 | GG Sips | UNCHANGED | D12 |
| 2026-09-22-foodland-b23 | Hayley Wilhelm MUA | UNCHANGED | B13 |
| 2026-09-22-foodland-b25 | West Shore Clothing and Surf Shop | UPDATE | B14 |
| 2026-09-22-harleys-c26 | 3 Sheets | REMOVE (archive) | — |
| 2026-09-22-quality-homes-d26 | Jen Brough | REMOVE (archive) | — |
| 2026-09-22-foodland-b28 | Wellness | UPDATE | B16 |
| 2026-09-22-harleys-c30 | Thornbury Cidery | UPDATE | D14 |
| 2026-09-22-quality-homes-d30 | Shroom Soda | UPDATE | F12 |
| 2026-09-22-foodland-b30 | Nature Babes | UPDATE | B17 |
| 2026-09-22-foodland-b32 | Jessica Connor & Rebecca Grubb — The WOMB Bruce County | UNCHANGED | B18 |
| 2026-09-23-foodland-e6 | Start of Day Movement | UPDATE | B21 |
| 2026-09-23-harleys-f7 | Wood Working | UPDATE | D22 |
| 2026-09-23-foodland-e7 | Liza Weltz — Essential Wellness | UNCHANGED | B22 |
| 2026-09-23-foodland-e9 | Rachel Stroeder — Evergreen Connections | UPDATE | B23 |
| 2026-09-23-harleys-f10 | Mary Kay (Cheryl McNair) | UNCHANGED | D23 |
| 2026-09-23-quality-homes-g10 | Liza Weltz — Essential Wellness | UNCHANGED | F22 |
| 2026-09-23-foodland-e12 | Susan Seitz — Susan Seitz Studio \| Creative Circle | UPDATE | B24 |
| 2026-09-23-harleys-f13 | Rachel Stroeder — Evergreen Connections | UPDATE | D24 |
| 2026-09-23-quality-homes-g13 | Cupcake decorating | UPDATE | F23 |
| 2026-09-23-foodland-e14 | The Maven Project — Ruth Montgomery | UNCHANGED | B25 |
| 2026-09-23-harleys-f16 | Flossie Mae Custom Hats | UPDATE | D25 |
| 2026-09-23-quality-homes-g16 | Bailey Donnelly — Redefined Smile featuring Airway Studio | REMOVE (archive) | — |
| 2026-09-23-foodland-e16 | Laurie Convay, ENJO Canada | UNCHANGED | B26 |
| 2026-09-23-foodland-e18 | Angela Wainscott, Upstaged Design | UNCHANGED | B27 |
| 2026-09-23-harleys-f21 | Simply Potts | UPDATE | D26 |
| 2026-09-23-foodland-e21 | Heather Stark, Willow Home | UNCHANGED | B28 |
| 2026-09-23-quality-homes-g22 | Bombshell | UPDATE | F24 |
| 2026-09-23-harleys-f24 | Willow Home Painting | UPDATE | D27 |
| 2026-09-23-foodland-e24 | Cody's Egg Shack | UNCHANGED | B29 |
| 2026-09-23-harleys-f26 | Cody's Egg Shack | UNCHANGED | D28 |
| 2026-09-23-foodland-e26 | Sadie Al, Lake Huron Home | UNCHANGED | B30 |
| 2026-09-23-quality-homes-g27 | Cottage Springs | UPDATE | F44 |
| 2026-09-23-foodland-e28 | J and H Womens’ Fashions | UPDATE | B31 |
| 2026-09-23-harleys-f30 | Formosa Spring Brewery | REMOVE (archive) | — |
| 2026-09-23-quality-homes-g30 | Grey Matter | UPDATE | F26 |
| 2026-09-23-foodland-e30 | Flossie Mae Custom Hats | UPDATE | B32 |
| 2026-09-23-foodland-e32 | Mary Kay (Cheryl McNair) | UPDATE | B33 |
| 2026-09-24-foodland-h6 | Christie Thomson — Definition Fitness | UNCHANGED | B37 |
| 2026-09-24-harleys-i7 | Christmas Urns | UPDATE | D38 |
| 2026-09-24-quality-homes-j7 | Bombshell | UPDATE | F38 |
| 2026-09-24-foodland-h7 | Pure Elegance Bridal | UNCHANGED | B38 |
| 2026-09-24-foodland-h9 | His Style | UNCHANGED | B39 |
| 2026-09-24-foodland-h11 | Elgin Jewelers | UPDATE | B40 |
| 2026-09-24-harleys-i12 | Susan Seitz — Susan Seitz Studio \| Creative Circle | UNCHANGED | D39 |
| 2026-09-24-quality-homes-j12 | Replanting house plants | UPDATE | F39 |
| 2026-09-24-quality-homes-j14 | Sampling cold brew | UPDATE | F40 |
| 2026-09-24-foodland-h14 | Hannah Greig — Naturally Well by Hannah | UNCHANGED | B42 |
| 2026-09-24-harleys-i16 | Doterra w Jodi | UPDATE | D40 |
| 2026-09-24-foodland-h16 | Tobermory Hyperbaric Chamber | REMOVE (archive) | — |
| 2026-09-24-foodland-h18 | Ashley Grant — Soul Purpose Reiki | UNCHANGED | B44 |
| 2026-09-24-quality-homes-j19 | D'elle Calhoun — Inside Out Art Studio / Corderro | UPDATE | F41 |
| 2026-09-24-foodland-h20 | The Feeling of Home - Designing Beyond the Trend | UPDATE | B45 |
| 2026-09-24-harleys-i21 | Ashley Grant — Soul Purpose Reiki | UNCHANGED | D41 |
| 2026-09-24-foodland-h23 | Ruth Montgomery (organization) | UPDATE | B46 |
| 2026-09-24-harleys-i24 | Mary Kay (Cheryl McNair) | UNCHANGED | D42 |
| 2026-09-24-quality-homes-j25 | Lamb Stick Sampling | UPDATE | F42 |
| 2026-09-24-foodland-h25 | Food and Drink | REMOVE (archive) | — |
| 2026-09-24-harleys-i27 | Oil Sampling | REMOVE (archive) | — |
| 2026-09-24-foodland-h27 | Essentially Lavender | UPDATE | B47 |
| 2026-09-24-quality-homes-j28 | Junction 56 | UPDATE | F43 |
| 2026-09-24-foodland-h28 | MNP Succession Planning | UPDATE | B48 |
| 2026-09-24-harleys-i31 | Essentially Lavender | UPDATE | D44 |
| 2026-09-24-quality-homes-j31 | Macleans | UPDATE | F60 |
| 2026-09-24-foodland-h31 | All things canning | REMOVE (archive) | — |
| 2026-09-25-foodland-k6 | Start of Day Movement | UPDATE | B53 |
| 2026-09-25-quality-homes-m7 | Costal Coffee | UPDATE | F54 |
| 2026-09-25-foodland-k7 | Food and Drink | UPDATE | B54 |
| 2026-09-25-foodland-k9 | Harley's Pub and Perk | UPDATE | B55 |
| 2026-09-25-quality-homes-m10 | All things honey -Jody | UNCHANGED | F55 |
| 2026-09-25-foodland-k11 | Hormones and Food | UPDATE | B56 |
| 2026-09-25-quality-homes-m12 | Harley's Sampling | UPDATE | F56 |
| 2026-09-25-foodland-k14 | Forest Maiden Facial and Beauty Room | UPDATE | B57 |
| 2026-09-25-quality-homes-m15 | The perfect Christmas Trees | UPDATE | F57 |
| 2026-09-25-harleys-l16 | Michelle Knoll — The Dragonfly Spa | UNCHANGED | D56 |
| 2026-09-25-foodland-k16 | By Grace Boutique | UPDATE | B58 |
| 2026-09-25-foodland-k18 | His Style | UPDATE | B59 |
| 2026-09-25-harleys-l19 | Fire Cider & Honey Sampling | UPDATE | D57 |
| 2026-09-25-quality-homes-m20 | Kerri @ The Farmhouse | UPDATE | F58 |
| 2026-09-25-foodland-k21 | Beth Fischer — Freezer Fitness | UPDATE | B61 |
| 2026-09-25-harleys-l22 | Sara Porter — Re:mind Wellness Spa & Apothecary | UPDATE | D58 |
| 2026-09-25-quality-homes-m23 | Forest Maiden Facial and Beauty Room | UPDATE | F59 |
| 2026-09-25-harleys-l27 | Connor Fischer — IncREDible Light | UNCHANGED | D59 |
| 2026-09-25-quality-homes-m27 | Neustadt Brewery | UPDATE | F25 |
| 2026-09-25-foodland-k28 | MNP Succession Planning | UPDATE | B65 |
| 2026-09-25-quality-homes-m30 | Crafty Elk | UNCHANGED | F61 |
| 2026-09-25-foodland-k31 | Home and Garden | UPDATE | B66 |
| 2026-09-25-foodland-k33 | Angela - Up stage Design | UPDATE | B67 |
| 2026-09-26-foodland-o8 | GINA LIVY | UPDATE | D71 |
| 2026-09-26-foodland-o18 | GINA LIVY | UPDATE | D73 |

## Release mechanism and validation

`backend/reconcile_landa_sept4.py` is offline and has no network/apply command. It validates the pinned workbook, explicitly matches existing identities, preserves all non-schedule fields, emits the reviewed transaction, and verifies its planned result. It refuses missing identities, collisions, unreviewed edits, unknown Lifestyles rows, and cross-event snapshots. New UUIDs are deterministic and event-scoped; rerunning the final snapshot plans zero writes.
The generated SQL locks only the schedule table for the bounded transaction, verifies the exact event slug/UUID and full preflight snapshot, applies narrow UPDATEs/INSERTs, and verifies 116 active items. An intervening organizer edit aborts the entire transaction. No persistent database function, schema migration, frontend change, or backend deployment is required.
Existing `status=archived` behavior removes withdrawn rows from both schedule lists while keeping direct UUID lookup available. An old saved link may show the retained old record; no old identity points to a replacement presenter.
Validation: 42 Python schedule/import tests passed, including 16 new cases and three real PostgreSQL transaction tests. 33 frontend schedule/admin tests passed. TypeScript and Python compilation passed. Local staging-context web build passed; its artifacts are not deployed. Exact workbook cells/dates/times/stages, corrected names, content preservation, duplicates, day moves, idempotency and concurrency aborts are covered.

Production SQL is prepared for separate review/authorization only. The legacy 107-row importer remains historical tooling and must not be run to restore the old schedule after this release. No bulk import or unrelated migration is part of this update.
