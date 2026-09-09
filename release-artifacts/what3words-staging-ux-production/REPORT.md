# What3words staging UX production restoration

Status: IN PROGRESS — no deployment performed.

Objective: restore the exact approved staging Emergency Home action, retaining the privacy-safe production backend.

Authority: 317ccd4faf72d5adcae086e84ee51bea5321892a / 6aa091b2b8f161cc3b981158.
Production baseline: 1b63ce2e140015fb25ef6137143217e25c856c27 / 6aa0bd481c247632e1a18d16.
Emergency page JSX, copy, styles and GPS flow already match staging exactly; only the Home action is missing. See staging-vs-production-ux.json, created before code changes.

Pre-deployment gates passed: 259 frontend tests; TypeScript; lint (0 errors, 46 existing warnings); build; 42 combined privacy/Notification Health backend tests; all focused browser scenarios, Home, Share, itinerary, offline and rendered staging parity. Expanded backend run: 85 passed, 3 unrelated legacy failures, reproduced on production baseline (see logs). Production backend unchanged. Current schedule 218 published/10 archived; vendors 127; reconciliation 100%. No production deployment yet. No notification sent.
