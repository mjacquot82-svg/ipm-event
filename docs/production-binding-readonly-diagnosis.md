# Production binding refusal: read-only evidence and prepared probe

Exact inspected backend: a28f44735b562e386ab4f2c1f575b7193fd06a06.
Exact inspected frontend: 83aea470edce3da16be02ee6f599e49a59cd165a.
The live backend health SHA and both live static binding assets match these sources.

## Evidence and limits

The externally reported immediate post-attempt database snapshot has both switches
OFF, pilot unset, bound timestamp NULL, valid armed invitation and zero reconciliation
rows. This excludes a committed partial binding at that snapshot, but says nothing
about equality of the supplied invitation digest or browser capability ownership.
Do not reinterpret invitation_valid as invitation_matches.

Available Render log searches since 2026-09-07T22:52:00Z returned no binding POST
and no binding-RPC entry. The only matching route entry retrieved was the investigator's
OPTIONS preflight at 2026-09-07T23:03:47.51602032Z, status 200. This was not a binding
retry. Current preflight allows the production origin, POST and the capability header.
Log absence is not proof of no request: coverage, latency and browser-side failures
remain unresolved. No exact failed gate can be assigned to Marc's historical attempt.

The page produces the same bound=false for origin rejection, inaccessible/missing/
malformed local capability, malformed invitation, fetch/CORS/timeout/JSON failures,
HTTP refusal and sanitized server refusal. Its password input has maxlength=43;
a longer invitation may be truncated, and no whitespace normalization occurs.
These are possible mechanisms, not findings about Marc's private input.

The frontend sends only invitation JSON plus the existing capability header. It
sends no event slug or invitation hash. The backend supplies its production event
and SHA-256 hashes the exact UTF-8 invitation string; it does not trim or decode it.
Current production activation checks require event ipm-2026, the production origin,
backend hostname and Supabase project tuple. No request payload or capability is
available in the inspected evidence, so actual ownership and eligible counts remain
unverifiable. The baseline schema declares unique(event_id, capability_hash), but
source constraints alone do not prove the current browser resolves to a row.

## Every binding refusal gate

Before RPC: production activation tuple, exact Origin, 43-character URL-safe
capability, maximum 128-byte body, valid JSON object containing only invitation,
and a 43-character URL-safe invitation. Transport/parse exceptions return 503;
ordinary refusals return 404. The browser discards that distinction.

Inside ipm_bind_reconciliation_pilot: missing singleton; observation ON; repair ON;
pilot already set; bound timestamp already set; missing stored invitation hash;
missing expiry; expiry at or before database clock; event other than ipm-2026;
invalid capability hash syntax; invalid invitation hash syntax; unequal invitation
hash; any reconciliation row; or eligible registration count not exactly one.
Eligible rows must join the production event by slug, match the capability hash,
and have an alphanumeric WonderPush installation identity of exactly 40 characters.
RPC/permission/schema errors and unexpected success-response shape are additional
transport outcomes, not SQL bound=false gates. None is established for this attempt.

## Prepared improvement (not deployed)

A separate `/api/production-diagnostics/pilot-binding` endpoint performs bounded
GETs with the existing private no-redirect urllib reader. It cannot invoke a binding
or reconciliation RPC, PATCH a provider, write metadata, consume an invitation,
or select a caller-supplied identifier. No migration or binding-function change.
Private query URLs/headers and exceptions are never logged or returned.

The separate `production-pilot-binding-check.html` / `.mjs` page reads the same
existing browser capability, checks origin and input format, and makes only the
read-only probe request after a button press. Its password input does not truncate
input, allowing the probe to report a format failure instead. It clears the input,
disables repeat clicks and prints only known states, booleans and counts.
It records request_attempted, response_received and HTTP status to distinguish
local failures from unreadable network responses. It cannot reconstruct the earlier
request and cannot distinguish every network failure (for example CORS vs outage).

The probe reports current switch/reference/invitation gates. Ownership reads require
both switches OFF, pilot unset, matching unexpired private invitation and zero
metadata. Zero or one owned row gets an exact eligible count. If two rows are returned,
it reports multiple_owned_registrations=true and READ_LIMIT with counts unverifiable,
never treats a truncated set as an exact count, and requires external schema/count
inspection. A second project read rejects changed project snapshots. This is a
non-atomic current-state probe, not an authorization to bind: expiry uses the backend
clock, registration/metadata may change between reads, and the actual binding RPC
must always recheck every gate atomically with the database clock.

Do not deploy during this task. After separate authorization, deploy the isolated
backend addition and only the two new standalone check assets with a complete
manifest preserving all existing assets, including the binding page and diagnostics.
No application rebuild is needed. Then a separately authorized check can inspect
Marc's same browser context and existing invitation without retrying binding.
Do not issue, renew, normalize, extend or replace the invitation to make a check pass.
If it expires, report expiry and stop; a future check cannot prove validity at the
original attempt. Never print private inputs or copy them into chat or console.

## Recommendation and verification

Do not retry binding without first establishing the failed gate. The invitation was
unconsumed and valid at the external snapshot, but its present validity and equality
to Marc's submitted value are not established. No unconditional reuse approval.
No binding security gate should be relaxed. Any correction depends on read-only
findings; changing code or data merely to force a bind is not justified.

Prepared tests cover gate classifications, ownership/installation eligibility,
private invitation comparison, multiple-row limits, changed snapshots, outages,
origin/body rejection, privacy canaries, no-write transport and existing binding
regressions. Only synthetic in-process data is used for the new probe tests.
