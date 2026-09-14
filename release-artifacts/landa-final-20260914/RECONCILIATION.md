# Audit before write — Landa final reconciliation

Starting canonical staging: Build 369860 / SHA 3198ab11f8345ed3be1ca15fd8db0d4f8b7dada4 / deploy 6aa856f926be0a00083049b1.

| Item | Supplied source | Current staging | Classification / required action |
| --- | --- | --- | --- |
| Brenda bio | Landa Sept. 9 email “Biography for Brenda Kraemer”, 1a0875de826de5d7; archived 01_Brenda_Kraemer_bio.txt | Full biography already present; wording matches source, earlier import normalized spacing | Already correct; no write |
| Brenda image | Same email explicitly says no picture/headshot; no attachment | No image | Already correct; add none |
| Carol event | Sept. 12 “Bio for Lifestyles Tent”, 1a0989742c346e82; forwarded James Wilton note explicitly says Carol's Thursday session; DOCX is about canning | Existing Thursday “Carrick Farm Market - All things Canning” | Correct existing target; preserve ID/title/time/location |
| Carol bio | Carol W bio re IPM.docx, original XML paragraphs inspected | Description null | Missing; add exact supplied four paragraphs, including “Take a peak” |
| Carol photo | Carol Weigel photo Aug 2026.jpg, visually inspected | No image | Missing; use original 480x640 portrait in existing event-image slot |
| Carrick Creek Farmstead logo | Copy of Carrick Creek Farmstead SOCIAL LOGO_just text 2.jpg, visually inspected | No separate logo slot | Not required; archive source only; do not replace portrait or create UI |
| Harley's forwarded material | Sept. 12 chain forwards Carol's material through James → Nicole/Harley's → Landa; no new Harley's bio/image/instructions | Existing Nikk/Harley's biography and portrait on four explicit business appearances | No app change required; forwarded context only |

The biography explicitly names Carrick Farm Market/Greenock Food Collective and Carrick Creek Farmstead preserves in distinct roles. Keep those exact terms in the supplied biography and preserve the authoritative event title. No naming ambiguity remains for the Thursday canning session.

Brenda: Country Garden Greenhouse - Christmas Urns; Thu Sept. 24, 2026, 10:15–11:00 AM; Harley's Pub & Perk - Stage; d2896e1e-8203-4e15-8ec8-ea1d82677e1f.
Carol: Carrick Farm Market - All things Canning; Thu Sept. 24, 2026, 4:15–5:00 PM; The Beyond Wireless Stage; 69f9ab32-bee3-5ac4-b97f-8c97d4b99bf7. All times America/Toronto.

Authoritative storage: IPM Staging Supabase project hooiqjcbcbwzjjvnwyxf, event 51000000-0000-4000-8000-000000000001 / ipm-staging, schedule_items.description + optional event_image. Existing media convention: source-identical frontend/public/event-media asset with HTTPS staging URL, alt and intrinsic dimensions. No schema or frontend renderer changes.

Exactly one existing row needs two content fields, plus its existing updated_at trigger. The two Tuesday Carrick records remain untouched because the supplied note identifies Thursday only. No Gina biography was supplied by these emails; Gina and earlier Lifestyles updates remain untouched. Source originals and hashes are retained alongside this audit. The logo is not published as app media.
