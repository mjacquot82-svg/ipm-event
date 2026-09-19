# Vendor Find on Map walkthrough

Baseline: staging 934f72e9, Build 376594. Returning attendees using Vendors Help received an informational `Find this vendor` dialog with Got it, no spotlight and no Click here cue. Its continuation also used an informational tip. Neither stage required the map action.

The Vendors screen now selects an eligible current vendor with trusted mapped geometry, preferring the visible filtered list. It reveals that vendor's actual Find on Map button, reuses the shared interaction callout and Click here cue, and invokes the existing map action only from that target. Skip tutorial and Escape retain dismissal/completion behavior. Unusable filters recover to a mapped vendor with an explanation; a catalog without mapped locations displays explicit guidance rather than silently ending.

Vendor-specific navigation parameters display a concise final location message on the map. Dismissing it clears only the continuation parameters and leaves the selected vendor highlighted. No Map Help launch or map-selection implementation changes are introduced.

Validation:
- Real public catalog browser regression at 320×568, 390×844, 768×1024 and 1440×900: completed Help replay, actual button bounds and touch, unrelated taps blocked, correct crosswalk destination/highlight/name, stale event and vendor selection replaced, final guidance, filter recovery, Skip/Escape, genuine first visit and no repeat.
- Browser-only catalog edge cases: unmapped filtered vendor recovery and no mapped vendors guidance.
- Shared first-visit, contextual Help/map-selection and cached offline replay regressions.
- 30 focused education, Click here, canonical vendor, unmapped vendor and staging catalog tests passed.
- Frontend production export passed; diff whitespace checks passed. Type check retains the existing unrelated itinerary.tsx:225 TS2367 finding.

Source scope: Vendors tutorial integration and component, shared renderer export/removal of obsolete Vendor-only wrapper, Vendor arrival hook on map, focused tests. Shared callout logic, Schedule tutorial, Map Help, map geometry/controls and all catalog data remain unchanged. Staging deployment only; production is untouched.

Browser evidence and live deployment verification are retained privately under `.artifacts/vendor-interactive/` in the active worktree. Marc's installed-PWA physical review remains the final acceptance step.
