# Temporary production read-only push diagnostic

Baseline: 38e0f62d96e01c7106f88163af6a60d27ed8a83d.
No current-main or staging reconciliation changes are included.

Backend: POST /api/production-diagnostics/push-target. A POST carries ephemeral
challenge-bound HMAC digests privately; this endpoint performs only GET operations.
Exact Render hostname, app origin, production database and event gates are required.
An existing capability selects at most two registration rows, constrained to the
production event. Exactly one match is required. One projected WonderPush GET
compares all four fields and privately checks the configured target. No retries,
redirects, registration, readiness updates, provider writes, sends or SDK init.
The canonical comparison module is copied unchanged from tested staging primitives.
Private urllib transport avoids HTTPX INFO URL logging of credentials/fingerprints.
Browser reread invalidates results if subscription/capability changed during the read.
Equality is a point-in-time observation, not evidence of physical receipt.

PREPARED ONLY. Deployment is a separate action. Preserve all existing frontend assets:
- diagnostics/production-push/production-push-diagnostic.html -> /api/production-push-diagnostic.html
- diagnostics/production-push/compare.mjs -> /api/production-push-compare.mjs

The production origin is essential: a Render-origin page cannot access the production
browser's storage or subscription. Do not run an Expo build/deploy of the app. These
standalone assets load no app/SDK code, register no worker, and write no storage.
Future URL: https://theipm.ca/api/production-push-diagnostic.html
Tap Compare current production subscription once; allow up to 45 seconds.

Before executing after a separately arranged deployment, verify that the static URL
returns this page rather than the app shell, JS has a JavaScript content type, and
CORS permits the production origin and capability header. Verify runtime production
gates; inspect deployment/access logging configuration for request-body/header capture.
Tests use sensitive canaries; live log verification cannot occur before deployment
and physical execution. Never emit raw diagnostic request/provider response data.
Keep the diagnostic until separately authorized cleanup.
