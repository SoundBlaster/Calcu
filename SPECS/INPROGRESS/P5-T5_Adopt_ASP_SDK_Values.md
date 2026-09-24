# P5-T5: Adopt ASP SDK Manifest and Grant Values

## Objective

Adopt the merged `@0al/agent-surface` offline value validators in Calcu for its
proposal-only manifest, trusted semantic Grant request, and selected issuer
Grant. This is an integration slice, not a transfer of Calcu's authority
boundary to the SDK.

## Scope and decisions

- Pin an immutable npm tarball built from the merged SDK `main` commit; retain
  the previous archive and record the new archive digest and commit provenance.
- Represent Calcu's existing one-action `proposal_only` surface as a complete
  SDK-valid manifest, with its input/output/event/receipt schemas and exposure
  declarations. Derive and check `surface_hash` with `SurfaceSnapshot` and
  `OfflineProposalManifest`.
- At issuance, construct the supported semantic request from trusted Calcu
  inputs and verified identity evidence. Prepare it against the retained
  manifest and derive its exposure projection.
- Construct the selected Grant from that projection; validate its closed
  shape, exact tuple, identity-evidence projection, Grant hash and exposure via
  `OfflineSelectedGrant` before storing or returning runtime access.
- Keep existing application-owned checks: current identity status and expiry,
  bearer secret custody, active/revoked/expired session state, audience,
  generation, correlation, action/mode/input, quotas, and HTTPS transport.
- Do not imply that SDK preparation authenticates identity, establishes user
  consent, issues authority, enforces retention, or admits an action.

## Test-first acceptance

1. Surface manifest is prepared by the SDK and exposes the expected action ID,
   surface hash, and exact source lock; malformed/unsupported declarations
   fail closed.
2. Issuance rejects SDK-invalid semantic request/selected Grant values before
   the Grant becomes active; accepted Grant hash and data exposure equal the
   SDK-prepared values.
3. Existing lifecycle, identity revalidation, credential, HTTPS and negative
   admission tests continue to prove `engineCalls === 0` for rejected calls.
4. Browser build stays free of Grant, identity, session and private-key code.

## Work phases

### A. Pin and inspect SDK

Build the reviewed package snapshot from merged SDK `main`, update dependency
metadata/provenance, and verify the archive is reproducible and the application
lockfile resolves it locally.

### B. Integrate value types

Add the complete static Calcu manifest and schemas. Migrate issuance to semantic
request and selected Grant validation without moving trusted state or transport
into the SDK.

### C. Verify and report

Update boundary/adoption documentation, run local quality gates and inspect the
diff for authority overclaims. Create a focused PR; leave merge to a separate
explicit instruction.

## Notes

Update `server/README.md`, `server/CONFORMANCE.md`,
`docs/ASP_ADOPTION_REPORT.md`, and `vendor/README.md`. Do not alter the normative
ASP repository or the HTTP wire shape except where the SDK's selected Grant
representation is internal to the server; HTTPS action request/response and
browser API remain unchanged.
