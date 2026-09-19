# Temporary interaction cues

Baseline staging: `66b62cc3566e156006bcd43a0c44610a6690955f` (Build 376546).

The existing `EducationCallout` in `MapEducation.tsx` shows a supplemental yellow **Click here** label and pointer only when `onTargetPress` is present and the target has valid measured bounds. It does not introduce a button, handler, or tutorial state. The existing dimming, spotlight, copy, target action, skip behavior, and persistence remain intact.

## Audit

The only current contextual consumers with a required target interaction are:

- Schedule: Tap an event → highlighted event card.
- Schedule: View event details → highlighted location/View on Map action.

Vendor Find on Map uses Got it. All five Maps tour stages, including Parade Routes, use Next/Got it. The Schedule introduction and map-arrival guidance are also informational. These steps receive no Click here cue and retain their existing behavior.

## Placement and accessibility

`placeTutorialCue` uses actual target bounds, viewport safe areas, the measured label size, and tutorial-card bounds. It tries above, below, left, and right without overlapping the target or explanatory card. If needed on a tight screen, the existing scrollable tutorial card reserves a strip for the cue. Its pointer ends six pixels from the actual target edge, beside the existing spotlight border. The existing 250 ms measurement refresh keeps the cue associated with scrolling and resized targets.

The entire cue has `pointerEvents="none"`, explicit web `aria-hidden`, and native accessibility hiding. Existing text continues to explain the action. The cue adds no animation and cannot bypass the required action. Its lifetime is the active callout's lifetime, so it disappears on action, Skip, close, and navigation.

## Verification

- Geometry unit tests cover all four sides, phone/tablet/desktop widths, safe areas, enlarged labels, moving targets, and avoiding target/card overlap.
- The real-data physical replay browser regression verifies both cues, arrow alignment, tappability, no informational cues, first visits, completed-user replay, filter recovery, and 320×568/390×667/390×844 layouts.
- The interaction browser regression verifies 320/768/1440 widths, scrolling association, keyboard accessibility, cue taps not advancing, required actions, unrelated taps, Skip/Escape cleanup, and empty Schedule handling.
- The first-visit browser regression checks Vendor and all Maps tour steps retain their informational controls without Click here.
- Build, focused unit tests, and `git diff --check` run before staging publication. The existing unrelated `itinerary.tsx:225 TS2367` type error is outside this change.

Raw verification output, screenshots, published bundle details, and checksums are retained privately under `.artifacts/click-cues/`. No Schedule data, map geometry, map-result presentation, tutorial progression, notifications, T-30, or production configuration is changed.
