# Temporary staging subscription comparison

Pixel URL: `https://staging.theipm.ca/api/subscription-compare.html`

Open it in the same Chrome profile as staging and tap **Compare current subscription once**. The isolated document avoids app/SDK initialization. `/api/` uses the existing worker's network pass-through, so navigation does not load the cached app shell. The worker is not modified or updated.

The browser reads the existing root registration and PushSubscription, then uses a fresh 32-byte cryptographic challenge as the HMAC-SHA-256 key. Each field is hashed independently over UTF-8 `ipm-subscription-compare-v1`, NUL, its fixed field name, NUL, and its canonical bytes. Endpoint bytes are the exact full HTTPS URL (never trimmed or rewritten). The encryption and application-server keys are raw decoded bytes, not base64 text. P-256 public keys must be 65-byte uncompressed points; auth must be 16 bytes. Missing or unreliable fields stop the comparison as unverifiable.

Only the challenge and four digests travel in the HTTPS POST body to the staging comparison endpoint; no cookie, endpoint, installation identifier, key, capability or credential is sent from the browser. The POST is a computation/read operation, not a provider or database mutation. No values or digests are persisted or logged. Nothing is returned except the aggregate true/false/unverifiable classification and, for complete comparisons, four field-match booleans.

The backend first checks the exact staging Render hostname, staging app URL and staging Supabase project. The route is absent on production. It reads only the authoritative registration target internally (requires exactly one row), then makes one WonderPush GET selecting precisely `pushToken.data`, `pushToken.p256dh`, `pushToken.auth`, and `pushToken.applicationServerKey`. Raw provider fields are reduced to comparison booleans inside the GET function. HTTP transport redirects and retries are disabled. Provider errors, malformed inputs, missing keys or ambiguous registration produce only unverifiable.

The button is disabled on its first activation and never retries. The backend has no automatic retry. Browser input reads have a five-second bound; the network comparison has a 75-second deadline to accommodate the existing 30-second database timeout plus the provider's 25-second timeout. A timeout leaves the provider outcome unknown and must not trigger a repeat.

Tests:

```
python -m pytest -q tests/test_staging_subscription_compare.py tests/test_staging_provider_diagnostic.py tests/test_notification_readiness.py
node --test diagnostics/staging-subscription-compare/compare.test.mjs
node --test diagnostics/staging-subscription-compare/browser.test.mjs
node diagnostics/staging-subscription-compare/build.mjs /tmp/ipm-subscription-artifact
```

Browser tests require Playwright; `PLAYWRIGHT_MODULE` can point to an existing installation. They use synthetic subscriptions and intercepted provider-comparison responses, never live provider data. The Python suite includes a Node-to-Python canonical encoding comparison.

Deployment: push the backend/source commit to staging with `[skip netlify]`. Publish only the three built diagnostic assets through an additive file-digest deployment to **ipm-web-staging**, preserving all currently published file digests. Do not rebuild Expo or the worker. Check that staging has not advanced before publication. Keep all changes off main and do not deploy the production site. Deployment verification must not submit a valid comparison payload: the only live provider comparison is Marc's explicit tap.

This diagnostic proves equality of the two snapshots, not successful physical notification delivery or subscription history. Remove the temporary route/module and three static assets in a later authorized cleanup; never clear browser storage to remove the diagnostic.
