# Temporary staging subscription repair

Prepared for the physical Pixel result on 2026-09-07: endpoint/p256dh/auth differ,
applicationServerKey matches. This repairs the targeted provider record; it does
not claim to establish why SDK synchronization stopped.

## Evidence and supported operation

- SDK inspected: https://cdn.by.wonderpush.com/sdk/1.1.44.0/wonderpush.min.js
  `ServiceWorkerClient` initialization reads/refreshes the subscription when
  permission is granted and the SDK is not manually unsubscribed.
  `Installation.addInstallationPushToken` compares endpoint, keys, options,
  user/installation identity and a seven-day `pushTokenCache`. A difference
  schedules `Rest.postEventually('/installation', ...)`; cache equality can
  suppress upload without reading the server's token. Cache writes are not
  proof of server acceptance. Initialization/registration/session/queue failures
  or a different SDK session installation remain possible. None is established
  by the existing boolean snapshot. Diagnostic pages intentionally do not init.
- https://docs.wonderpush.com/docs/website-sdk-reference says repeated `init`
  has no effect. The public subscription API does not guarantee a token-only
  update preserving an existing subscription; IPM's orphan recovery can unsubscribe.
- https://docs.wonderpush.com/reference/patch-installations-installationid
  documents PATCH as partially updating an existing installation, with `userId`
  and JSON `body` parameters. No PUT, POST/upsert, delete or SDK private API is used.
- https://docs.wonderpush.com/docs/importing-web-push-subscribers documents the
  four Web Push token fields and URL-safe unpadded Base64 encoding. We use that
  mapping with PATCH, not the guide's create/import operation.

## Guarded execution

Only the exact staging Render hostname, staging public URL and staging Supabase
URL enable the route. Require staging Origin, explicit action header, and the
existing Pixel device capability. Read exactly one database registration and
compare its capability hash in memory. No database mutation or readiness refresh.

The standalone `/api/subscription-repair.html` reads the existing capability and
root worker PushSubscription. It never initializes WonderPush, subscribes,
unsubscribes, registers/updates a worker, changes permission or writes storage.
On one deliberate tap, the four current subscription fields and ephemeral
comparison challenge/digests go privately in a TLS POST body to staging. No
sensitive fields are rendered, logged, returned, placed in URLs or persisted by
this implementation. The provider credential remains on the backend.

Before PATCH, one projected provider GET must reproduce exactly the observed
three mismatches and matching application server key. Already matching is a
no-op; every other pattern refuses repair. PATCH includes only the four token
fields for the database-selected existing installation, anonymous userId empty.
One subsequent projected GET uses the SAME HMAC comparator as the read-only
comparison. Even an ambiguous PATCH timeout is followed only by a read, never a
retry. A process-local attempt latch prevents a second mutation in that process;
it is not a durable cross-restart/distributed lock. The page button is one-shot.

Afterward the browser rereads its subscription and compares ephemeral digests
with its pre-update snapshot. It will not report current match=true if that
subscription changed during the request. All output is booleans or fixed enums.
No notification operation is imported or invoked.

## Deploy and use

Build three additive assets with `node diagnostics/staging-subscription-repair/build.mjs DIR`.
The existing deployed `/api/subscription-compare.mjs` is a dependency. Preserve
all previous Netlify asset digests, especially app and service worker. Push only
staging with `[skip netlify]`, then publish the additive artifact to the staging
Netlify site. No production build, deploy, environment, main or Notify Everyone change.

Physical execution cannot be completed remotely: the browser material was never
returned by the previous comparison. Open this URL in the same Chrome profile:
https://staging.theipm.ca/api/subscription-repair.html
Tap **Reconcile existing subscription once**. Allow two minutes; do not retry.
Do not send a notification unless the result reports comparison=true and
browser_subscription_preserved=true. This confirms association, not device receipt.
