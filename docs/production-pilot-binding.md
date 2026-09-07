# Private one-shot production pilot binding

This additive change is based directly on backend
`741d51ecff5fb11e522e481e32ca02ee0430052d` and frontend
`1d66efe668b08062faba1887992cdd3793c1e8ae`. It does not bind or enable anything
merely by being deployed. The original migration is unchanged.

## Why a separate invitation

The existing release provides capability-authenticated eligibility and reconciliation,
but no binding operation. The diagnostic resolves ownership read-only; it does not
provide an operator with a private binding reference. Public first-caller binding
would let any attendee with a valid capability claim the pilot.

An external trusted operator must issue a cryptographically random 32-byte
base64url invitation (43 characters without padding), privately deliver it ONLY
to Marc, and store only its SHA-256 digest with a short expiry. The invitation
is separate from notification targeting and grants no ability to nominate another
registration. Possession of the invitation plus Marc's existing browser capability
is required. It does not establish a person's identity independently of that
private delivery and correct browser context. Never derive a pilot from the test
allowlist, latest registration, or counts. Never share the browser capability.

## Later external deployment/action sequence (not executed by preparation)

1. Through the secure external Supabase integration, apply ONLY additive migration
   `20260907000200_subscription_reconciliation_binding.sql` transactionally after
   the already-applied reviewed `00100` migration. Confirm both switches false,
   pilot unset, invitation unset, bound timestamp unset, and zero reconciliation
   rows. Existing service-role-only table privileges cover the new columns; the
   new binding RPC is also service-role-only. Do not reapply `00100`.
2. Deploy the isolated backend child commit. With no invitation armed, the binding
   endpoint returns sanitized refusal. Verify existing routes/diagnostic and
   reconciliation health still show both switches off and pilot count zero.
3. Publish ONLY the two new frontend `public/api/production-pilot-binding.*`
   assets alongside the reviewed production assets. They are standalone; no new
   app bundle or service-worker activation is needed for binding. Keep all existing
   diagnostics available. This is a later explicit deployment, not a preparation
   step. The rest of the reconciliation frontend retains its reviewed SHA/build.
4. Immediately before Marc is ready, issue and privately deliver the invitation
   in the secure external workflow. Arm it using bound parameters in this guarded
   statement; never put literal invitation/hash values in a transcript or logs:

   ```sql
   update public.notification_reconciliation_project
   set binding_invitation_hash = $1, binding_expires_at = now() + interval '10 minutes'
   where singleton and enabled = false and repair_enabled = false
     and pilot_registration_id is null and pilot_bound_at is null
     and binding_invitation_hash is null
     and not exists (select 1 from public.notification_reconciliation);
   ```

   Require affected row count exactly one. Parameter `$1` is the digest, never the
   plaintext invitation. No public API can arm invitations. Expired invitations
   remain unusable; any replacement requires a separately reviewed external
   operator action. Do not log input, request headers/bodies or SQL parameters.
5. Marc opens `https://theipm.ca/api/production-pilot-binding.html` in the SAME
   production browser/profile used for the diagnostic, enters the private
   invitation and presses **Bind this device** once. Do not use an in-app browser
   from a messaging application. No identifier/capability needs to be copied.
   The page reads the same existing `@ipm_notification_capability_v1` value as the
   production diagnostic; it never creates/rebinds registrations, initializes
   the SDK, reads/creates a subscription, or changes permission/storage.
6. Require sanitized `bound=true`, `pilot_restriction_count=1`,
   `observation_enabled=false`, `repair_enabled=false`. The server hashes the
   supplied capability and invitation and calls the private SQL function using
   a POST body. Under a singleton lock it resolves exactly one production event
   registration owned by that capability, locks that registration, assigns it,
   consumes the invitation and records the bound timestamp atomically. Neither
   switch is assigned or enabled. Existing metadata must still be empty.
7. Verify externally, without selecting raw IDs: pilot count one, both switches
   false, invitation/expiry cleared, bound timestamp present and reconciliation
   count zero. On Marc's browser the existing capability-authenticated eligibility
   endpoint must return `pilot_eligible=true` and both switches false. Rerun the
   existing diagnostic read-only to verify the same browser's registration remains
   identified. Binding itself does not compare subscription/provider material.
   Keep observation and repair OFF. No notification is authorized.

A consumed invitation makes subsequent binding requests unavailable (HTTP 404).
A timeout/503 may mean the transaction committed: the page does not retry. Stop
and perform the external sanitized read-only checks and same-browser eligibility
check before considering any further action. Never clear the pilot to retry.
`pilot_bound_at` also prevents a consumed invitation being reused after an
accidental reference clear. Service-role operators remain privileged; this is a
one-shot application gate, not protection against privileged database rewrites.

All refusal responses contain only `bound=false`; they do not claim the live
switches are OFF. Only a successful transaction proves both were OFF under its
lock. A later privileged switch change requires a fresh read; preparation does
not independently verify current production database state.

## Rollback

Leave both rollout switches OFF. Remove the standalone binding assets/route if
needed. The additive migration's commented rollback drops only its function and
three columns; it preserves the pilot reference and existing switches. Removing
the consumed marker removes its extra replay protection, so disable the binding
caller first. No client or provider changes are needed.

## Prepared validation

- Additive migration SHA-256:
  `f7b539a5f1caf10305f6664fe2b10b9dd7acc8d0403dbb7d0cd3d7345a1976c3`.
- Original `00100` SHA-256 remains
  `0706da195a4c3b337e10d2f821a20fa8065b408e9b540eabefcc648c43d86e43`.
- 97 Python tests passed, including real loopback PostgreSQL binding and existing
  reconciliation coordination/regression tests; five pre-existing deprecation
  warnings remain.
- 24 Node tests passed, including the standalone binding page, existing pilot card,
  lifecycle, subscription preservation and privacy tests.
- Fresh local migration defaults, grants, additive rollback, Python compilation,
  JavaScript syntax and diff checks passed. Static artifact contains exactly the
  two new page/module assets; no TypeScript or application bundle was changed.
- No production database/API/provider access, deployment, binding, invitation
  issuance, switch activation, allowlist change or notification occurred during
  preparation. Live OFF state is the externally reported state, not a new live
  measurement by this preparation session.
