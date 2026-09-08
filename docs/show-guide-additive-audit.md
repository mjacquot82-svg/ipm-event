# Show Guide additive completeness audit — September 8, 2026

**Decision: zero additions.** Every reviewed session with a defensible existing category is accounted for. Missing public programs require category coverage decisions; they are withheld. This is an audit-only release, based on the verified Landa staging release. No database mutation, migration or deployment is necessary.

Source: [Official IPM 2026 Show Guide](https://www.plowingmatch.org/ipm2026/wp-content/uploads/2026/08/IPM-2026-Show-Guide.pdf). Download SHA-256: `299162198140ae80d3bc4a83feaa1bafe01736f7918cdfd9171aa20710860bee`. All 33 PDF pages were screened using extracted text and visual overviews; the complete schedule spreads (printed pp.36–40 / PDF pp.19–21) were visually inspected. Timed references elsewhere were cross-checked. The image-only Tuesday VIP Plowing callout is included, with an explicit tentative/public-access caveat. Source times below are local Ontario time; no missing end time is invented.

Staging baseline: `release/landa-sept4-lifestyles` / `eeb3ddc25840d98b7bd9b3016b1bd8fca0bb1443`. Staging has 170 stored records: 160 active (116 Lifestyles plus 44 other events), and 10 archived Landa withdrawals. Production has 151 stored records and remains untouched.

## Pre-mutation accounting

No staging mutation was proposed or performed. The audit reviewed **206 references**, comprising **172 primary timed session candidates**, **10 repeated timed references elsewhere**, and **24 contextual/operational notices**. Thus 182 timed references represent 172 distinct candidates. Repeated references do not become duplicate events. Counts below include all 206 review units.

| Classification | References |
|---|---:|
| MATCHED_EXISTING | 98 |
| MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION | 11 |
| ADD_MISSING | 0 |
| CATEGORY_AMBIGUOUS | 73 |
| IDENTITY_AMBIGUOUS | 0 |
| NOT_AN_APP_SCHEDULE_EVENT | 24 |

The 73 category-ambiguous references represent **67 distinct session candidates plus six repeated RAM Rodeo references**. The 11 newer-correction references comprise nine primary rows (including two archived withdrawals) and two repeated Gina Livy article references. There are no unresolved identity matches within the existing categories. Tentative time/public-access questions remain on withheld candidates.

## Existing taxonomy and category evidence

| Existing category | Production active | Staging active | Comparable event / classification evidence |
|---|---:|---:|---|
| MNP Lifestyles Tent Events | 107 | 116 | Hayley Wilhelm MUA, Gina Livy, Carrick Farm Market: established Lifestyles program; all 116 protected. |
| Ontario Mutuals Main Stage - In the Britespan Building | 17 | 17 | Dave & The Retros, Queen of the Furrow speeches: Ontario stage music/speeches, not the plowing competition. |
| CKNX Centennial Pavilion (GFO Stage) Lounge | 16 | 16 | Naomi Bristow, Whiskey Pine: daytime CKNX stage program; venue does not classify Sunday worship. |
| The Bruce RV Park - Nightly Entertainment | 6 | 6 | Adam Cousins, Tandem: nightly RV program; retains this category despite existing CKNX location labels. |
| Parade Week | 5 | 5 | Bruce Power Opening Day Parade, Children’s Parade: actual parades; not riding demonstrations or competitions. |

**Exact proposed additions/category assignments: none.** No missing candidate meets HIGH-confidence assignment to these five categories. Nothing is forced into a stage category based on location. No category or existing assignment changes.

## MISSING_CATEGORY_COVERAGE

| Program family / venue | Distinct candidates | Examples | Category evidence / recommendation |
|---|---:|---|
| RAM Truck Corral | 21 | Gregglea Clydesdales; Canadian Cowgirls; RAM Rodeo; Farmer Olympics | No comparable equestrian/arena category. Consider dedicated arena programming coverage after approval. |
| Event Centre #1 — West 2 | 16 | Farmall Square Dancing Tractors; Lawn Mower Races; Combine Demolition Derby | No comparable competition/demonstration category. Consider Event Centre programming coverage after approval. |
| Great Canadian Lumberjack Show | 15 | Three shows daily, September 22–26 | No existing comparable stage-program category. Consider public demonstrations/attractions coverage after approval; confirm venue. |
| Plowing fields / VIP Gate 1 | 14 | Tractors; Horse Plowing; Queen of the Furrow plowing; junior competition; tentative VIP Plowing | Queen speeches are a different event purpose. Consider plowing coverage after approval. VIP time is approximate and public accessibility unconfirmed. |
| CKNX Sunday worship | 1 | September 20, 14:30 Church Service | CKNX venue alone is insufficient. Review special/community programming coverage; no automatic stage-category assignment. |

All 67 are CATEGORY_AMBIGUOUS and withheld. Nine have additional confirmation needs: Tuesday 11:00 Gregglea (TBC), seven Lawn Mower Races (TBC), and Tuesday approximately 14:00 VIP Plowing. These are not nine extra events. Category expansion is a future scope decision, not performed here.

## Printed conflicts intentionally ignored

| Printed reference | Retained decision |
|---|---|
| p.36 · 2026-09-22 · Opening Ceremonies | Retain reviewed IPM 13:00 closing time for Opening Ceremonies rather than printed 13:30. |
| p.36 · 2026-09-22 · Susan Briggs | Retain reviewed IPM 15:30 start for Susan Briggs rather than printed 15:00. |
| p.36 · 2026-09-22 · MakeUp Artist - Hayley Wilhelm | Preserve Landa-confirmed Hayley Wilhelm MUA; not an extra makeup session. |
| p.37 · 2026-09-23 · Flossy May | Flossy May is the confirmed Flossie Mae; retain corrected name and ID. |
| p.38 · 2026-09-24 · Naturally Well by Hannah | Printed 12:00 AM is a typo; retain Landa September 4 12:00–12:30 PM. |
| p.38 · 2026-09-24 · Essentially Lavender | Retain expanded September 4 Essentially Lavender session 14:45–15:30, not printed 15:15–15:30. |
| p.38 · 2026-09-24 · Greenock Collective - All things Canning | Printed Greenock session is archived. Carrick is a distinct September 4 replacement with its own ID; do not restore or repurpose Greenock. |
| p.40 · 2026-09-26 · Doors Open | Retain Landa-confirmed 12:30–13:30 afternoon doors period; do not add printed older noon period. |
| p.38 · 2026-09-24 · Southampton Olive Oil | Archived after Landa September 4 withdrawal; do not resurrect the printed session. |
| p.52 · 2026-09-26 · Gina Livy - The Livy Method | The article identifies the old Foodland stage; retain September 4 Harley’s stage and existing Gina identity. |
| p.52 · 2026-09-26 · Gina Livy - The Livy Method | The article identifies the old Foodland stage; retain September 4 Harley’s stage and existing Gina identity. |

Hayley Wilhelm MUA, Forest Maiden Facial & Beauty Room, Flossie Mae, The Beyond Wireless Stage, Gina Livy sessions/doors, Carrick Farm Market, Jen Fitzgerald / Soul Journey, brewery moves, fitness segments and makeover reveals remain exactly as the September 4 release. Greenock and Jen Brough IDs/content stay archived; distinct replacement presenters retain distinct identities. The Show Guide’s omission of most demonstration-stage details does not remove them. Closing Ceremonies retains its reviewed 17:00 end even though the guide gives only a 16:00 start.

## Duplicate and preservation controls

Crosswalks use stable external identities plus date, presenter, program and purpose. Aliases/shorthand (Mary Kay, J&H, Ivelyn, punctuation) are matched semantically. Repeated printed references link to a canonical primary entry. Existing archived targets are explicitly retained as archived. Zero additions means no new IDs, favorites/deep-link changes, or category assignments. The offline validator compares all 170 complete before/after rows, including descriptions, bios, images/links embedded in content, location metadata, source fields and timestamps. It separately reruns the authoritative 116-item workbook reconciliation and checks all 10 withdrawals.

## Complete source crosswalk

Each primary row is a distinct scheduled candidate. Supplemental rows repeat the canonical key in the JSON manifest. Context rows are untimed notices, operating hours or a different-year registration advertisement. For CATEGORY_AMBIGUOUS entries, proposed category is unassigned, confidence UNRESOLVED; the family evidence above explains why no comparable existing event supports an assignment.

| Key / printed page | Date | Printed title | Printed time | Venue / program | Classification | Existing category / retained record |
|---|---|---|---|---|---|---|
| p36-22-ontario-1 | 2026-09-22 | Opening Ceremonies | 11:30–13:30 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION | Ontario Mutuals Main Stage - In the Britespan Building; Opening Ceremonies; 11:30–13:00; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p36-22-ontario-2 | 2026-09-22 | Dave & The Retros | 13:30–15:00 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Dave & The Retros; 13:30–15:00; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p36-22-ontario-3 | 2026-09-22 | Susan Briggs | 15:00–17:00 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION | Ontario Mutuals Main Stage - In the Britespan Building; Susan Briggs; 15:30–17:00; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p36-22-cknx-1 | 2026-09-22 | Riverside Blues Band | 13:30–15:00 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Riverside Blues Band; 13:30–15:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p36-22-cknx-2 | 2026-09-22 | He Said, She Said | 15:30–17:00 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; He Said, She Said; 15:30–17:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p37-23-ontario-1 | 2026-09-23 | PJ Mack & Gord Cottrill | 10:30–12:30 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; PJ Mack & Gord Cottrill; 10:30–12:30; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p37-23-ontario-2 | 2026-09-23 | Dennis Bushell | 13:00–14:30 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Dennis Bushell; 13:00–14:30; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p37-23-ontario-3 | 2026-09-23 | Bernie Hale | 15:00–17:00 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Bernie Hale; 15:00–17:00; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p37-23-cknx-1 | 2026-09-23 | Dave & The Retros | 10:30–12:00 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Dave & The Retros; 10:30–12:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p37-23-cknx-2 | 2026-09-23 | Lisa McEwen | 12:30–13:30 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Lisa McEwen; 12:30–13:30; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p37-23-cknx-3 | 2026-09-23 | Blake Wilson | 14:00–15:00 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Blake Wilson; 14:00–15:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p37-23-cknx-4 | 2026-09-23 | Armow Grinders | 15:30–17:00 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Armow Grinders; 15:30–17:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p38-24-ontario-1 | 2026-09-24 | Ivelyn Koebel | 10:30–11:30 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Ivelyn Koebel; 10:30–11:30; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p38-24-ontario-2 | 2026-09-24 | Mudmen | 12:00–14:00 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Mudmen; 12:00–14:00; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p38-24-ontario-3 | 2026-09-24 | Owen Sound Step Dancers Club | 14:30–15:30 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Owen Sound Step Dancers Club; 14:30–15:30; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p38-24-ontario-4 | 2026-09-24 | Jammin’ North | 16:00–17:00 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Jammin’ North; 16:00–17:00; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p38-24-cknx-1 | 2026-09-24 | Andrew McVeety | 10:30–12:30 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Andrew McVeety; 10:30–12:30; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p38-24-cknx-2 | 2026-09-24 | Naomi Bristow | 13:00–15:30 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Naomi Bristow; 13:00–15:30; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p38-24-cknx-3 | 2026-09-24 | Chicken Jockey | 16:00–17:00 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Chicken Jockey; 16:00–17:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p39-25-ontario-1 | 2026-09-25 | Speeches, Ontario Queen of the Furrow Competition | 10:00–13:00 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Queen of the Furrow Speeches; 10:00–13:00; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p39-25-ontario-2 | 2026-09-25 | Saugeen First Nations | 13:00–15:00 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Saugeen First Nations; 13:00–15:00; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p39-25-ontario-3 | 2026-09-25 | J.C Duo | 15:30–17:00 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; J.C Duo; 15:30–17:00; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p39-25-cknx-1 | 2026-09-25 | Hard Martin & The Heros | 10:30–12:30 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Hard Martin & The Heros; 10:30–12:30; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p39-25-cknx-2 | 2026-09-25 | Mandi Craddock | 13:00–15:00 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Mandi Craddock; 13:00–15:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p39-25-cknx-3 | 2026-09-25 | No Expectations | 15:30–17:00 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; No Expectations; 15:30–17:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p40-26-ontario-1 | 2026-09-26 | Kerry Moore School Dance | 10:00–11:00 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Kerry Moore School of Dance; 10:00–11:00; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p40-26-ontario-2 | 2026-09-26 | Lennon & Matthew | 11:30–12:30 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Lennon & Matthew; 11:30–12:30; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p40-26-ontario-3 | 2026-09-26 | Grey Bruce Singers | 13:00–14:00 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Grey Bruce Singers; 13:00–14:00; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p40-26-ontario-4 | 2026-09-26 | Shania Twang | 14:00–16:00 | Ontario Mutuals Main Stage - In the Britespan Building | MATCHED_EXISTING | Ontario Mutuals Main Stage - In the Britespan Building; Shania Twang; 14:00–16:00; Ontario Mutuals Main Stage - In the Britespan Building; published |
| p40-26-cknx-1 | 2026-09-26 | Whiskey Pine | 10:30–12:30 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Whiskey Pine; 10:30–12:30; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p40-26-cknx-2 | 2026-09-26 | Jeremy Mighton | 13:00–14:30 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Jeremy Mighton; 13:00–14:30; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p40-26-cknx-3 | 2026-09-26 | EV Outlaws | 15:00–16:00 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; EV Outlaws; 15:00–16:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p40-26-cknx-4 | 2026-09-26 | IPM 2026 Closing Ceremonies | 16:00 | CKNX Centennial Pavilion (GFO Stage) Lounge | MATCHED_EXISTING | CKNX Centennial Pavilion (GFO Stage) Lounge; Closing Ceremonies; 16:00–17:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p36-22-parade-1 | 2026-09-22 | Bruce Power Opening Day Parade | 10:00 | Parade route (not specified in printed schedule) | MATCHED_EXISTING | Parade Week; Bruce Power Opening Day Parade; 10:00–unspecified; Parade route coming soon; published |
| p37-23-parade-1 | 2026-09-23 | Trucks and Tractors Parade | 11:00 | Parade route (not specified in printed schedule) | MATCHED_EXISTING | Parade Week; Trucks and Tractors Parade; 11:00–unspecified; Parade route coming soon; published |
| p38-24-parade-1 | 2026-09-24 | Children’s Parade | 11:00 | Parade route (not specified in printed schedule) | MATCHED_EXISTING | Parade Week; Children’s Parade; 11:00–unspecified; Parade route coming soon; published |
| p39-25-parade-1 | 2026-09-25 | Combines Parade | 11:00 | Parade route (not specified in printed schedule) | MATCHED_EXISTING | Parade Week; Combines Parade; 11:00–unspecified; Parade route coming soon; published |
| p40-26-parade-1 | 2026-09-26 | Bruce County Farming Through the Ages Parade | 11:00 | Parade route (not specified in printed schedule) | MATCHED_EXISTING | Parade Week; Bruce County Farming Through the Ages; 11:00–unspecified; Parade route coming soon; published |
| p36-21-rv-1 | 2026-09-21 | Weekend Never Ends | 19:00–22:00 | The Bruce RV Park program (existing records use CKNX venue label) | MATCHED_EXISTING | The Bruce RV Park - Nightly Entertainment; Weekend Never Ends; 19:00–22:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p36-22-rv-1 | 2026-09-22 | Adam Cousins | 19:00–22:00 | The Bruce RV Park program (existing records use CKNX venue label) | MATCHED_EXISTING | The Bruce RV Park - Nightly Entertainment; Adam Cousins; 19:00–22:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p37-23-rv-1 | 2026-09-23 | Colt McLauchlin | 19:00–22:00 | The Bruce RV Park program (existing records use CKNX venue label) | MATCHED_EXISTING | The Bruce RV Park - Nightly Entertainment; Colt McLauchlin; 19:00–22:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p38-24-rv-1 | 2026-09-24 | The Skeleton Crew | 19:00–22:00 | The Bruce RV Park program (existing records use CKNX venue label) | MATCHED_EXISTING | The Bruce RV Park - Nightly Entertainment; The Skeleton Crew; 19:00–22:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p39-25-rv-1 | 2026-09-25 | Catfish Gumbo | 19:00–22:00 | The Bruce RV Park program (existing records use CKNX venue label) | MATCHED_EXISTING | The Bruce RV Park - Nightly Entertainment; Catfish Gumbo; 19:00–22:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p40-26-rv-1 | 2026-09-26 | Tandem | 19:00–22:00 | The Bruce RV Park program (existing records use CKNX venue label) | MATCHED_EXISTING | The Bruce RV Park - Nightly Entertainment; Tandem; 19:00–22:00; CKNX Centennial Pavilion (GFO Stage) Lounge; published |
| p36-22-lifestyles-1 | 2026-09-22 | Start of Day Movement - Definition Fitness | 10:00–10:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Christie Thomson — Definition Fitness; 10:00–10:15; The Beyond Wireless Stage; published |
| p36-22-lifestyles-2 | 2026-09-22 | Aaniin Collective | 10:15–10:50 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Aaniin Collective (Hannah Wheeler); 10:15–10:50; The Beyond Wireless Stage; published |
| p36-22-lifestyles-3 | 2026-09-22 | Davishill Nursery | 10:50–11:20 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Davishill Nursery; 10:50–11:20; The Beyond Wireless Stage; published |
| p36-22-lifestyles-4 | 2026-09-22 | Sleepers Bed Gallery | 11:25–11:45 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Sleepers Bed Gallery (Sadie Al); 11:25–11:45; The Beyond Wireless Stage; published |
| p36-22-lifestyles-5 | 2026-09-22 | Carrick Farm Market | 12:00–12:30 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Carrick Farm Market; 12:00–12:30; The Beyond Wireless Stage; published |
| p36-22-lifestyles-6 | 2026-09-22 | Harley’s Charcuterie | 12:30–13:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Harley's Pub and Perk - Charcuterie; 12:30–13:00; The Beyond Wireless Stage; published |
| p36-22-lifestyles-7 | 2026-09-22 | Liesemer Home Hardware - Meat Smoking | 13:00–13:30 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Liesemer Home Hardware - Meat Smoking; 13:00–13:30; The Beyond Wireless Stage; published |
| p36-22-lifestyles-8 | 2026-09-22 | Photography Beitz Studio | 13:45–14:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Photography Beitz Studios; 13:45–14:15; The Beyond Wireless Stage; published |
| p36-22-lifestyles-9 | 2026-09-22 | MakeUp Artist - Hayley Wilhelm | 14:15–14:45 | MNP Lifestyles Tent | MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION | MNP Lifestyles Tent Events; Hayley Wilhelm MUA; 14:15–14:45; The Beyond Wireless Stage; published |
| p36-22-lifestyles-10 | 2026-09-22 | West Shore | 14:45–15:10 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; West Shore Clothing and Surf Shop; 14:45–15:10; The Beyond Wireless Stage; published |
| p36-22-lifestyles-11 | 2026-09-22 | Makeover Reveal! | 15:10–15:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Makeover Reveal!; 15:10–15:15; The Beyond Wireless Stage; published |
| p36-22-lifestyles-12 | 2026-09-22 | The Space Between | 15:30–16:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; The Space Between with Alicia; 15:30–16:00; The Beyond Wireless Stage; published |
| p36-22-lifestyles-13 | 2026-09-22 | The Nature Babe | 16:00–16:30 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; The Nature Babe; 16:00–16:30; The Beyond Wireless Stage; published |
| p36-22-lifestyles-14 | 2026-09-22 | The WOMB - Bruce County | 16:30–17:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Jessica Connor & Rebecca Grubb — The WOMB Bruce County; 16:30–17:00; The Beyond Wireless Stage; published |
| p37-23-lifestyles-1 | 2026-09-23 | Start of Day Movement - Freezer Fitness | 10:00–10:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Start of Day Movement - Freezer Fitness; 10:00–10:15; The Beyond Wireless Stage; published |
| p37-23-lifestyles-2 | 2026-09-23 | Essential Wellness | 10:15–10:45 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Liza Weltz — Essential Wellness; 10:15–10:45; The Beyond Wireless Stage; published |
| p37-23-lifestyles-3 | 2026-09-23 | Doula Panel | 10:45–11:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Doula Panel — Rachel Stroeder, Katie Franklin & Madison Kittel; 10:45–11:15; The Beyond Wireless Stage; published |
| p37-23-lifestyles-4 | 2026-09-23 | Susan Seitz Art Studio | 11:15–11:45 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Susan Seitz — Susan Seitz Studio  /  Creative Circle; 11:15–11:45; The Beyond Wireless Stage; published |
| p37-23-lifestyles-5 | 2026-09-23 | Energy in the Home | 12:00–12:30 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; The Maven Project — Ruth Montgomery; 12:00–12:30; The Beyond Wireless Stage; published |
| p37-23-lifestyles-6 | 2026-09-23 | Enjo | 12:30–13:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Laurie Convay, ENJO Canada; 12:30–13:00; The Beyond Wireless Stage; published |
| p37-23-lifestyles-7 | 2026-09-23 | Upstage Design | 13:00–13:30 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Angela Wainscott, Upstaged Design; 13:00–13:30; The Beyond Wireless Stage; published |
| p37-23-lifestyles-8 | 2026-09-23 | Willow Home - Furniture Refresh | 13:45–14:30 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Heather Stark, Willow Home; 13:45–14:30; The Beyond Wireless Stage; published |
| p37-23-lifestyles-9 | 2026-09-23 | Cody’s Egg Shack | 14:30–15:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Cody's Egg Shack; 14:30–15:00; The Beyond Wireless Stage; published |
| p37-23-lifestyles-10 | 2026-09-23 | Lake Huron Home | 15:00–15:30 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Sadie Al, Lake Huron Home; 15:00–15:30; The Beyond Wireless Stage; published |
| p37-23-lifestyles-11 | 2026-09-23 | J&H Women’s Fashions | 15:30–16:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; J&H Women's Fashions; 15:30–16:00; The Beyond Wireless Stage; published |
| p37-23-lifestyles-12 | 2026-09-23 | Flossy May | 16:00–16:30 | MNP Lifestyles Tent | MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION | MNP Lifestyles Tent Events; Flossie Mae; 16:00–16:30; The Beyond Wireless Stage; published |
| p37-23-lifestyles-13 | 2026-09-23 | Mary Kay | 16:30–16:55 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Mary Kay (Cheryl McNair); 16:30–16:55; The Beyond Wireless Stage; published |
| p37-23-lifestyles-14 | 2026-09-23 | Makeover Reveal! | 16:55–17:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Makeover Reveal!; 16:55–17:00; The Beyond Wireless Stage; published |
| p38-24-lifestyles-1 | 2026-09-24 | Start of Day Movement - Definition Fitness | 10:00–10:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Christie Thomson — Definition Fitness; 10:00–10:15; The Beyond Wireless Stage; published |
| p38-24-lifestyles-2 | 2026-09-24 | Pure Elegance Bridal | 10:15–10:45 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Pure Elegance Bridal; 10:15–10:45; The Beyond Wireless Stage; published |
| p38-24-lifestyles-3 | 2026-09-24 | His Style | 10:45–11:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; His Style; 10:45–11:15; The Beyond Wireless Stage; published |
| p38-24-lifestyles-4 | 2026-09-24 | Elgin Jewelers | 11:15–11:40 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Elgin Jewelers; 11:15–11:40; The Beyond Wireless Stage; published |
| p38-24-lifestyles-5 | 2026-09-24 | Makeover Reveal! | 11:40–11:45 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Makeover Reveal!; 11:40–11:45; The Beyond Wireless Stage; published |
| p38-24-lifestyles-6 | 2026-09-24 | Naturally Well by Hannah | 00:00–12:30 | MNP Lifestyles Tent | MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION | MNP Lifestyles Tent Events; Hannah Greig — Naturally Well by Hannah; 12:00–12:30; The Beyond Wireless Stage; published |
| p38-24-lifestyles-7 | 2026-09-24 | Re:mind Spa & Apothecary | 12:30–13:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Re:mind Spa & Apothecary; 12:30–13:00; The Beyond Wireless Stage; published |
| p38-24-lifestyles-8 | 2026-09-24 | Soul Purpose Reiki | 13:00–13:30 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Ashley Grant — Soul Purpose Reiki; 13:00–13:30; The Beyond Wireless Stage; published |
| p38-24-lifestyles-9 | 2026-09-24 | The Feeling of Home | 13:30–14:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; The Feeling of Home - Designing Beyond the Trend - Panel Discussion; 13:30–14:15; The Beyond Wireless Stage; published |
| p38-24-lifestyles-10 | 2026-09-24 | The Maven Project | 14:15–14:45 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; The Maven Project — Ruth Montgomery; 14:15–14:45; The Beyond Wireless Stage; published |
| p38-24-lifestyles-11 | 2026-09-24 | Essentially Lavender | 15:15–15:30 | MNP Lifestyles Tent | MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION | MNP Lifestyles Tent Events; Essentially Lavender; 14:45–15:30; The Beyond Wireless Stage; published |
| p38-24-lifestyles-12 | 2026-09-24 | MNP: Planning for a Successful Transition | 15:30–16:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; MNP Panel Discussion: Planning for a Successful Transition; 15:30–16:15; The Beyond Wireless Stage; published |
| p38-24-lifestyles-13 | 2026-09-24 | Greenock Collective - All things Canning | 16:15–17:00 | MNP Lifestyles Tent | MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION | MNP Lifestyles Tent Events; All things canning; 16:15–17:00; The Beyond Wireless Stage; archived |
| p39-25-lifestyles-1 | 2026-09-25 | Start of Day Movement - Freezer Fitness | 10:00–10:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Start of Day Movement - Freezer Fitness; 10:00–10:15; The Beyond Wireless Stage; published |
| p39-25-lifestyles-2 | 2026-09-25 | Fire Cider & Honey | 10:15–10:45 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Fire Cider & Honey - Homesteading; 10:15–10:45; The Beyond Wireless Stage; published |
| p39-25-lifestyles-3 | 2026-09-25 | Harley’s Pub and Perk | 10:45–11:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Harley's Pub and Perk - Meal Prep; 10:45–11:15; The Beyond Wireless Stage; published |
| p39-25-lifestyles-4 | 2026-09-25 | Hormones and Food - Jennifer Dunsmoor | 11:15–12:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Hormones and Food - Jennifer Dunsmoor; 11:15–12:00; The Beyond Wireless Stage; published |
| p39-25-lifestyles-5 | 2026-09-25 | Forest Maiden Facial & Beauty Room | 12:00–12:30 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Forest Maiden Facial & Beauty Room; 12:00–12:30; The Beyond Wireless Stage; published |
| p39-25-lifestyles-6 | 2026-09-25 | Shop by Grace | 12:30–13:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; by Grace Boutique; 12:30–13:00; The Beyond Wireless Stage; published |
| p39-25-lifestyles-7 | 2026-09-25 | His Style | 13:00–13:25 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; His Style; 13:00–13:25; The Beyond Wireless Stage; published |
| p39-25-lifestyles-8 | 2026-09-25 | Makeover Reveal! | 13:25–13:30 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Makeover Reveal!; 13:25–13:30; The Beyond Wireless Stage; published |
| p39-25-lifestyles-9 | 2026-09-25 | Freezer Fitness | 13:45–14:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Beth Fischer — Freezer Fitness; 13:45–14:00; The Beyond Wireless Stage; published |
| p39-25-lifestyles-10 | 2026-09-25 | Functional Movement - Freezer Fitness | 14:00–14:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Functional Movement — Freezer Fitness; 14:00–14:15; The Beyond Wireless Stage; published |
| p39-25-lifestyles-11 | 2026-09-25 | Line Dancing - Freezer Fitness | 14:15–14:45 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Line Dancing — Freezer Fitness; 14:15–14:45; The Beyond Wireless Stage; published |
| p39-25-lifestyles-12 | 2026-09-25 | IncREDible Light | 14:45–15:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Connor Fischer — IncREDible Light; 14:45–15:15; The Beyond Wireless Stage; published |
| p39-25-lifestyles-13 | 2026-09-25 | MNP - Navigating the Succession Journey | 15:30–16:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; MNP Panel Discussion: Navigating the Succession Journey; 15:30–16:15; The Beyond Wireless Stage; published |
| p39-25-lifestyles-14 | 2026-09-25 | Carrie Lynn Floral + Event Styling | 16:15–16:45 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Carrie Lynn Floral + Event Styling; 16:15–16:45; The Beyond Wireless Stage; published |
| p39-25-lifestyles-15 | 2026-09-25 | Up Stage Design | 16:45–17:30 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Angela Wainscott, Upstaged Design; 16:45–17:30; The Beyond Wireless Stage; published |
| p40-26-lifestyles-1 | 2026-09-26 | Doors Open | 09:00–10:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Doors Open — Gina Livy (Morning); 09:00–10:00; Harley's Pub & Perk - Stage; published |
| p40-26-lifestyles-2 | 2026-09-26 | Gina Livy - The Livy Method | 10:00–11:00 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Gina Livy - The Livy Method; 10:00–11:00; Harley's Pub & Perk - Stage; published |
| p40-26-lifestyles-3 | 2026-09-26 | Doors Open | 12:00–13:00 | MNP Lifestyles Tent | MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION | MNP Lifestyles Tent Events; Doors Open — Gina Livy (Afternoon); 12:30–13:30; Harley's Pub & Perk - Stage; published |
| p40-26-lifestyles-4 | 2026-09-26 | Gina Livy - The Livy Method | 13:30–14:30 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; Gina Livy - The Livy Method; 13:30–14:30; Harley's Pub & Perk - Stage; published |
| p38-24-lifestyles-14 | 2026-09-24 | Southampton Olive Oil | 14:45–15:15 | MNP Lifestyles Tent | MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION | MNP Lifestyles Tent Events; Food and Drink; 14:45–15:15; The Beyond Wireless Stage; archived |
| p36-20-worship-1 | 2026-09-20 | Church Service | 14:30 | CKNX Centennial Pavilion (GFO Stage) | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p36-22-ram_corral-1 | 2026-09-22 | Gregglea Clydesdales | 11:00 (TBC / approximate) | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p36-22-ram_corral-2 | 2026-09-22 | Canadian Cowgirls Precision Drill Team | 14:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p36-22-ram_corral-3 | 2026-09-22 | Beef Farmers of Ontario, Farmer Olympics, Plowing Match Style | 15:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-ram_corral-1 | 2026-09-23 | Gregglea Clydesdales | 10:30 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-ram_corral-2 | 2026-09-23 | Canadian Cowgirls Precision Drill Team | 11:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-ram_corral-3 | 2026-09-23 | Canadian Cowgirls Precision Drill Team | 15:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-ram_corral-1 | 2026-09-24 | Gregglea Clydesdales | 10:30 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-ram_corral-2 | 2026-09-24 | Canadian Cowgirls Precision Drill Team | 11:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-ram_corral-3 | 2026-09-24 | RAM Rodeo | 12:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-ram_corral-4 | 2026-09-24 | Canadian Cowgirls Precision Drill Team | 14:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-ram_corral-5 | 2026-09-24 | RAM Rodeo | 15:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-ram_corral-1 | 2026-09-25 | Gregglea Clydesdales | 10:30 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-ram_corral-2 | 2026-09-25 | Canadian Cowgirls Precision Drill Team | 11:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-ram_corral-3 | 2026-09-25 | RAM Rodeo | 12:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-ram_corral-4 | 2026-09-25 | Canadian Cowgirls Precision Drill Team | 14:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-ram_corral-5 | 2026-09-25 | RAM Rodeo | 15:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p40-26-ram_corral-1 | 2026-09-26 | Gregglea Clydesdales | 10:30 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p40-26-ram_corral-2 | 2026-09-26 | Canadian Cowgirls Precision Drill Team | 11:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p40-26-ram_corral-3 | 2026-09-26 | RAM Rodeo | 12:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p40-26-ram_corral-4 | 2026-09-26 | Canadian Cowgirls Precision Drill Team | 14:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p40-26-ram_corral-5 | 2026-09-26 | RAM Rode | 15:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p36-22-plowing-1 | 2026-09-22 | Tractors | 09:30 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p36-22-plowing-2 | 2026-09-22 | Horse Plowing | 10:00 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p36-22-plowing-3 | 2026-09-22 | Tractors | 11:00 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-plowing-1 | 2026-09-23 | Tractors | 09:30 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-plowing-2 | 2026-09-23 | Horse Plowing | 10:00 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-plowing-3 | 2026-09-23 | Tractors | 11:00 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-plowing-1 | 2026-09-24 | Tractors | 09:30 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-plowing-2 | 2026-09-24 | Horse Plowing | 10:00 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-plowing-3 | 2026-09-24 | Tractors | 11:00 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-plowing-4 | 2026-09-24 | Queen of the Furrow Plowing Competition | 14:30 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-plowing-1 | 2026-09-25 | Tractors | 09:00 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-plowing-2 | 2026-09-25 | Horse Plowing | 09:00 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p40-26-plowing-1 | 2026-09-26 | Junior Competition (tractors and horses) | 08:30 | Plowing fields; gate routing shown in guide | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p36-22-plowing-4 | 2026-09-22 | VIP Plowing | 14:00 (TBC / approximate) | VIP Plowing - Gate 1 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p36-22-lumberjack-1 | 2026-09-22 | Great Canadian Lumberjack Show | 10:30 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p36-22-lumberjack-2 | 2026-09-22 | Great Canadian Lumberjack Show | 13:00 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p36-22-lumberjack-3 | 2026-09-22 | Great Canadian Lumberjack Show | 15:00 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-lumberjack-1 | 2026-09-23 | Great Canadian Lumberjack Show | 10:30 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-lumberjack-2 | 2026-09-23 | Great Canadian Lumberjack Show | 13:00 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-lumberjack-3 | 2026-09-23 | Great Canadian Lumberjack Show | 15:00 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-lumberjack-1 | 2026-09-24 | Great Canadian Lumberjack Show | 10:30 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-lumberjack-2 | 2026-09-24 | Great Canadian Lumberjack Show | 13:00 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-lumberjack-3 | 2026-09-24 | Great Canadian Lumberjack Show | 15:00 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-lumberjack-1 | 2026-09-25 | Great Canadian Lumberjack Show | 10:30 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-lumberjack-2 | 2026-09-25 | Great Canadian Lumberjack Show | 13:00 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-lumberjack-3 | 2026-09-25 | Great Canadian Lumberjack Show | 15:00 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p40-26-lumberjack-1 | 2026-09-26 | Great Canadian Lumberjack Show | 10:30 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p40-26-lumberjack-2 | 2026-09-26 | Great Canadian Lumberjack Show | 13:00 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p40-26-lumberjack-3 | 2026-09-26 | Great Canadian Lumberjack Show | 15:00 | Show location not specified in the schedule callout | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p36-22-event_centre-1 | 2026-09-22 | Foxton Fuels Farmall Square Dancing Tractors | 11:00 | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p36-22-event_centre-2 | 2026-09-22 | Lawn Mower Races | 15:30 (TBC / approximate) | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-event_centre-1 | 2026-09-23 | Lawn Mower Races | 09:30 (TBC / approximate) | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-event_centre-2 | 2026-09-23 | Foxton Fuels Farmall Square Dancing Tractors | 12:00 | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-event_centre-3 | 2026-09-23 | Foxton Fuels Farmall Square Dancing Tractors | 13:30 | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p37-23-event_centre-4 | 2026-09-23 | Lawn Mower Races | 15:30 (TBC / approximate) | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-event_centre-1 | 2026-09-24 | Lawn Mower Races | 09:30 (TBC / approximate) | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-event_centre-2 | 2026-09-24 | Foxton Fuels Farmall Square Dancing Tractors | 10:30 | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-event_centre-3 | 2026-09-24 | Foxton Fuels Farmall Square Dancing Tractors | 13:00 | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p38-24-event_centre-4 | 2026-09-24 | Lawn Mower Races | 15:30 (TBC / approximate) | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-event_centre-1 | 2026-09-25 | Lawn Mower Races | 09:30 (TBC / approximate) | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-event_centre-2 | 2026-09-25 | Foxton Fuels Farmall Square Dancing Tractors | 11:30 | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p39-25-event_centre-3 | 2026-09-25 | Teeswater Agro Parts Combine Demolition Derby | 15:30 | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p40-26-event_centre-1 | 2026-09-26 | Lawn Mower Races | 09:30 (TBC / approximate) | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p40-26-event_centre-2 | 2026-09-26 | Foxton Fuels Farmall Square Dancing Tractors | 11:30 | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p40-26-event_centre-3 | 2026-09-26 | Teeswater Agro Parts Combine Demolition Derby | 15:30 | Event Centre #1 — West 2 | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p7-24-ram_corral-1 | 2026-09-24 | RAM Rodeo | 12:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p7-24-ram_corral-2 | 2026-09-24 | RAM Rodeo | 15:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p7-25-ram_corral-1 | 2026-09-25 | RAM Rodeo | 12:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p7-25-ram_corral-2 | 2026-09-25 | RAM Rodeo | 15:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p7-26-ram_corral-1 | 2026-09-26 | RAM Rodeo | 12:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p7-26-ram_corral-2 | 2026-09-26 | RAM Rodeo | 15:00 | RAM Truck Corral | CATEGORY_AMBIGUOUS | Unassigned — do not add |
| p51-24-lifestyles-1 | 2026-09-24 | MNP panel discussions: Transition your farm on your terms | 15:30–16:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; MNP Panel Discussion: Planning for a Successful Transition; 15:30–16:15; The Beyond Wireless Stage; published |
| p51-25-lifestyles-1 | 2026-09-25 | MNP panel discussions: Transition your farm on your terms | 15:30–16:15 | MNP Lifestyles Tent | MATCHED_EXISTING | MNP Lifestyles Tent Events; MNP Panel Discussion: Navigating the Succession Journey; 15:30–16:15; The Beyond Wireless Stage; published |
| p52-26-lifestyles-1 | 2026-09-26 | Gina Livy - The Livy Method | 10:00–11:00 | MNP Lifestyles Tent / Foodland Stage (article introduction, p.51) | MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION | MNP Lifestyles Tent Events; Gina Livy - The Livy Method; 10:00–11:00; Harley's Pub & Perk - Stage; published |
| p52-26-lifestyles-2 | 2026-09-26 | Gina Livy - The Livy Method | 13:30–14:30 | MNP Lifestyles Tent / Foodland Stage (article introduction, p.51) | MATCHED_EXISTING_WITH_NEWER_IPM_CORRECTION | MNP Lifestyles Tent Events; Gina Livy - The Livy Method; 13:30–14:30; Harley's Pub & Perk - Stage; published |
| p36-22-education_note-1 | 2026-09-22 | Hydro One Education Centre — various hands-on activities/crops/livestock displays | Untimed | education_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p36-22-farm_future_note-1 | 2026-09-22 | Teeswater Concrete Farming For The Future Tent — Enviro Farm and agricultural displays | Untimed | farm_future_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p36-22-demo_note-1 | 2026-09-22 | Two demonstration stages running in the MNP Lifestyles Tent | Untimed | demo_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p36-22-routing_note-1 | 2026-09-22 | Plowing/shuttle gate directions | Untimed | routing_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p37-23-education_note-1 | 2026-09-23 | Hydro One Education Centre — various hands-on activities/crops/livestock displays | Untimed | education_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p37-23-farm_future_note-1 | 2026-09-23 | Teeswater Concrete Farming For The Future Tent — Enviro Farm and agricultural displays | Untimed | farm_future_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p37-23-demo_note-1 | 2026-09-23 | Two demonstration stages running in the MNP Lifestyles Tent | Untimed | demo_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p37-23-routing_note-1 | 2026-09-23 | Plowing/shuttle gate directions | Untimed | routing_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p38-24-education_note-1 | 2026-09-24 | Hydro One Education Centre — various hands-on activities/crops/livestock displays | Untimed | education_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p38-24-farm_future_note-1 | 2026-09-24 | Teeswater Concrete Farming For The Future Tent — Enviro Farm and agricultural displays | Untimed | farm_future_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p38-24-demo_note-1 | 2026-09-24 | Two demonstration stages running in the MNP Lifestyles Tent | Untimed | demo_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p38-24-routing_note-1 | 2026-09-24 | Plowing/shuttle gate directions | Untimed | routing_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p39-25-education_note-1 | 2026-09-25 | Hydro One Education Centre — various hands-on activities/crops/livestock displays | Untimed | education_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p39-25-farm_future_note-1 | 2026-09-25 | Teeswater Concrete Farming For The Future Tent — Enviro Farm and agricultural displays | Untimed | farm_future_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p39-25-demo_note-1 | 2026-09-25 | Two demonstration stages running in the MNP Lifestyles Tent | Untimed | demo_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p39-25-routing_note-1 | 2026-09-25 | Plowing/shuttle gate directions | Untimed | routing_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p40-26-education_note-1 | 2026-09-26 | Hydro One Education Centre — various hands-on activities/crops/livestock displays | Untimed | education_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p40-26-farm_future_note-1 | 2026-09-26 | Teeswater Concrete Farming For The Future Tent — Enviro Farm and agricultural displays | Untimed | farm_future_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| p40-26-routing_note-1 | 2026-09-26 | Plowing/shuttle gate directions | Untimed | routing_note | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| context-10-203 | — | IPM general opening hours (Hours heading) | 08:30–17:00 | operational_notice | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| context-10-204 | — | Daily events run / general admission hours | 08:30–17:00 | operational_notice | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| context-10-205 | — | Scooter reservation telephone office hours | 08:00–17:00 | operational_notice | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| context-62-206 | — | Scooter reservation telephone office hours | 08:00–17:00 | operational_notice | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |
| context-63-207 | — | March Classic 2027 advertisement / December 31 registration deadline | 23:59 | operational_notice | NOT_AN_APP_SCHEDULE_EVENT | Not a standalone app session |

## Validation

- Backend/data: 54 tests passed, including four real local PostgreSQL tests (three inherited Landa tests and one Show Guide read-only transaction/category-count check). The Show Guide suite has 12 tests, all executed with a real staging snapshot and disposable local PostgreSQL.
- Frontend schedule/admin/filter tests: 33 passed. TypeScript no-emit check passed. Python compilation passed.
- Fresh staging SQL snapshot: all 170 complete rows unchanged, 160 active, all 116 Landa active items correct, 10 withdrawals preserved, five category counts 116/17/16/6/5, zero duplicate external identities or active session signatures.
- Fresh production SQL snapshot: all 151 complete schedule rows unchanged.
- Public staging API: all 160 active IDs, content, dates, times and categories match the database. Local staging-mode web build passed. Detailed results are recorded in the release verification artifact. No interactive browser test or staging deployment is claimed. A local build-only placeholder public push key is used because the checkout lacks that deployment value; the build is not deployed.
- No migration, runtime/frontend code change, data write or notification action. The branch contains only the source crosswalk, this report, an offline validator and tests.

## Marc’s remaining decision

Whether to authorize a future taxonomy expansion for the 67 withheld session candidates, and then confirm the tentative sessions/public access. Within the current five-category constraint, there are no safe missing additions left to implement. Production schedule promotion remains separately authorized work.
