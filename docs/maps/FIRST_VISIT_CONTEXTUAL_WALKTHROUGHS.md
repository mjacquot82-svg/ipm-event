# First-visit contextual walkthroughs — staging

Base: e9da95e2c9e95e34f9bb4dc1d62f07911fd06bdf. Findings were reported before editing.

## Historical sequence retained

Schedule's fuller historical walkthrough combines the Plan your day introduction (`eb91008d`, made modal in `fc3eb2a2`), event-details spotlight (`597df7d6`) and event-location spotlight (`cd3b8375`). The attendee closes the introduction, opens the highlighted event and sees its Find on Map action explained. This is retained, with current browsing/day/search wording and the original conditional reminder explanation. No replacement tutorial engine or obsolete Schedule UI was introduced.

The original Vendor education was the eligible Find on Map action spotlight (`cd3b8375`), not an undiscovered multi-page tour. The already-reconciled Vendor Help introduction now opens automatically on a fresh section visit, followed by that original spotlight when a mapped action is visible. This avoids an apparently absent walkthrough when no mapped vendor card is currently in view. No vendor location is invented.

## Entry, completion and replay

Schedule and Vendors check completion on focused section entry. Their existing section flags remain authoritative: Schedule introduction acknowledgement and Vendor Find on Map acknowledgement. Maps retains its independent maps-tour flag. Historical completed users are not forcibly re-onboarded.

Schedule's introduction queues the recovered details/location steps. Continuing acknowledges entry completion and permits the queued steps for that visit. Skip clears remaining steps. Dismissing the details explanation also ends the pending sequence; opening the highlighted event continues to the location explanation. Leaving the section clears pending requests; previously unviewed independent tip flags cannot cause surprise tips on later visits. Manual Help queues the same steps without deleting completion keys.

Vendors follows the same entry/skip/replay model. The introductory Got it continues to the original mapped-action spotlight; Skip ends the walkthrough. Maps retains its five-step completion/skip and manual replay. Event/vendor destination map arrivals remain deferred to preserve location highlighting; a normal first Maps visit launches the tour.

## Safe staging preview

Open one of these URLs on staging:

- https://staging.theipm.ca/schedule?previewWalkthrough=1
- https://staging.theipm.ca/vendors?previewWalkthrough=1
- https://staging.theipm.ca/map?previewWalkthrough=1

The hostname check accepts only staging.theipm.ca and local development hosts. Production ignores the parameter. It temporarily ignores this section's existing completion flag for that page instance; it removes no storage keys and resets no other app state. Completion/skip still records completion. Return to the plain section URL to check normal subsequent-visit behavior. Reloading the explicit preview URL intentionally previews again. Normal Help requires no parameter or storage clearing.

## Validation

Browser tests exercise clean isolated state in order Schedule → Vendors → Maps, completion, section independence, second visits, manual replay, fresh skips, and preview preservation of unrelated storage. Widths: 320, 768 and 1440 pixels. Existing offline PWA replay and event/vendor map identity tests remain in the validation set. External writes and notification-provider requests are blocked in browser tests; fixture responses exist only within the test browser.

No event data, vendor data, route geometry, parade controls, parking artwork, notification analytics or T-30 delivery logic is changed. Builds run in the established task-owned /tmp validation tree after storage review; no install, worktree creation or evidence deletion was needed.
