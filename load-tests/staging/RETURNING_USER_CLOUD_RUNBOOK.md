# Returning-user static-manifest test runbook

This package is staging-only and models a returning attendee whose cached Schedule
and Announcements revisions are unchanged. It makes one setup GET and then only
`https://staging.theipm.ca/content-manifest.json` GETs. It never calls attendee
content APIs, vendors, Render, Supabase, notification providers, or mutations.

The script is [returning-user-static-manifest.js](./returning-user-static-manifest.js).
The pure validation tests are [returning-user-static-manifest.test.mjs](./returning-user-static-manifest.test.mjs).

## Before any run

Marc must approve the phase separately. Confirm the Grafana Cloud stack's current
protocol-VU limit, remaining VUh allowance, load zone, retention and checkout price.
The free Grafana Cloud k6 tier is documented as 500 VUh/month with no credit card;
Pro starts at a $19/month platform fee plus usage. New-subscription Fractional VUH
v2 uses `(maximum VUs × execution minutes) / 60`, with volume adjustments. A rough
planning estimate is 8.33 VUh for a five-minute 100-VU run and 220 adjusted VUh for
the historical 1,000-VU shape (15 minutes of peak-duration accounting). Actual
billing follows the account's current terms and actual runtime. Never authorize paid
usage from this document; verify the checkout/usage screen immediately before run.

No production credential is needed. Never paste a Grafana token into chat, source,
the repository, screenshots or a command history. Store it only in Grafana's login
flow or the operator's secret environment. Do not create an account on Marc's behalf.

## A. Grafana Cloud login and project

1. Marc creates or signs into a Grafana Cloud account at the official Grafana site.
2. Open the k6 Performance Testing stack and confirm the project/stack and a public
   North American load zone. Do not select local execution: local execution would
   preserve Marc's network egress.
3. Authenticate the k6 CLI with `k6 cloud login`, or use `K6_CLOUD_TOKEN` and
   `K6_CLOUD_STACK_ID` as ephemeral secret environment variables. Keep both out of
   Git and chat. Use the installed k6 version recorded with the run.

## B. Offline checks and commands

From the repository root, run the offline checks first:

```sh
node --check load-tests/staging/returning-user-static-manifest.js
node --test load-tests/staging/returning-user-static-manifest.test.mjs
```

The setup function obtains the manifest baseline at execution time. It rejects
non-JSON/HTML, wrong identity, missing revisions and any revision change. The exact
staging URL is hard-coded and target overrides are rejected before setup traffic.

## C. Step 1 — 100-VU verification

After Marc's explicit approval, run one cloud verification. This command contains no
secret; authentication is already held by the CLI session:

```sh
k6 cloud run --env SCENARIO=VERIFY load-tests/staging/returning-user-static-manifest.js
```

The `VERIFY` scenario ramps to 100 VUs for a short verification window. Watch the
Grafana run page for `valid_manifest_success` (at least 99%), `http_req_failed`
(below 1%), `manifest_transport_errors`, checks, status-0 errors, and HTTP status
breakdowns. The script aborts on a non-transport manifest validation failure and
thresholds request abort on sustained failure. A transport failure may be reported
before threshold abort; stop the run manually immediately if transport errors or
wrong-target indicators appear. Export the run's JSON/CSV summary and save the
dashboard URL, run ID, script checksum, k6 version, load zone and setup revisions in
the approved evidence location.

Local comparison, only when separately desired, uses the same script and target:

```sh
k6 run --env SCENARIO=VERIFY load-tests/staging/returning-user-static-manifest.js
```

That local command is not an independent egress test and must not replace cloud
verification. Do not add `--local-execution` to the cloud command.

## D. Stop and results

Use Grafana's Stop/Abort control or Ctrl-C for a local run. Preserve the final summary
and error samples before closing the run. Do not retry failed requests in the script
or by wrapping the command; a second run requires a new approval and a fresh baseline.
If the manifest revision changes because staging content was published, stop and
record that result. Do not fetch Schedule or Announcements to investigate it.

## E. Step 2 — separately approved 1,000-VU test

Stop after Step 1 and wait for Marc. Only after separate approval and current cost
verification, run:

```sh
k6 cloud run --env SCENARIO=RETURNING_1000 load-tests/staging/returning-user-static-manifest.js
```

This is the historical shape: 0→100 (1m), 100→250 (1m), 250→500 (2m),
500→750 (2m), 750→1,000 (2m), hold 1,000 (5m), ramp down (2m). There is no
2,000-VU scenario in this package. A later 2,000-VU run requires a new reviewed
change and Marc's separate approval.

No load test is authorized or executed by preparing this package.
