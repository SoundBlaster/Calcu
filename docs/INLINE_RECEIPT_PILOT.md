# Opt-in HTTP inline receipt pilot

2026-10-03 UTC. SDK [PR #40](https://github.com/0al-spec/agent-surface-js/pull/40)
is deliberately left unmerged. Calcu installs immutable archive snapshots from
its exact commit `920f85cedda7ab7f5e1da4511577aefb9b3613c2`, not a branch URL
or `npm link`. [Provenance and digests](../vendor/README.md) are repository-local.

## Scope

The default demo still selects surface `0.1.3` and its existing local wire.
`prepareInlineCalcuSurface()` opts into `0.1.4-inline-pilot`, explicitly selecting
the merged ASP HTTP inline receipt delivery profile for `calculation.propose`.
The selection changes the surface hash and the issuer creates a matching new Grant.
The four operations, proposal mode, deny credential release, disclosure classes,
quota and identity/session authority checks are unchanged. This is a test pilot,
not a UI/live Codex activation or production certification.

```text
Native LocalBackend (owns operands/runtime context)
  → test-only SDK inline adapter (real prepared manifest + issuer Grant)
  → HTTPS POST /agent-actions (pinned CA + loopback SAN)
  → selected wire parser
  → unchanged authoritative Calcu admission fence
  → Calcu engine
  → complete App Receipt in namespaced carrier
  → SDK pair integrity + native Calcu result/receipt acceptance
```

The native in-memory wire remains inside the trusted process. Only the closed
selected RFC wire crosses HTTPS. A complete Runtime Receipt is carried in the
request and a complete App Receipt in the result, alongside its ID/hash references.
No missing-carrier, bare-hash or URL downgrade is accepted. Existing default-wire
clients cannot call the selected pilot by falling back to a raw receipt field.
Input disclosure remains application-owned; receipt fields are covered explicitly
as runtime context and fixed protocol statuses before response serialization.

## Independent trust and lifecycle checks

The pilot passes an actual `PreparedOfflineSelectedGrant` retained by the issuer,
not a synthetic collaborator. `executor.selectedGrant(credential)` is a trusted
server-only composition seam, not an HTTP/tool/browser capability. It exposes a
validated immutable snapshot, not current authorization; the executor must still
check current revocation, generation, identity, expiry and quota on every request.

Expected receipt context is retained before send from trusted access and the
host-generated operation. It is never derived from the response. Policy IDs and
versions are host selections. The test listener is bound first, then its actual
port is used in the prepared manifest; the transport endpoint must equal the
advertised `action_url`. The client validates the pinned certificate and loopback
SAN, follows no redirects, bounds bodies/time and requires exact `no-store` on
successful responses. HTTPS authenticates this selected local server, not arbitrary
receipt issuers or the claimed agent binary. Compatibility Bearer does not provide
Proof-Bound client authentication.

The SDK reports only `integrity_checked`; producer authentication, current authority,
trusted time and application acceptance remain `not_verified` there. Calcu's
separate executor performs authority checks and the native backend retains its
exact displayed-operation/result acceptance. Neither proves natural-language intent.
Receipts and Grant details stay server-side; only the normal calculation result
is returned to the application facade. No receipt signing, approvals, durable
effects, automatic retries or retention probes are added.

## Verification

`server/inlineReceiptPilot.test.ts` exercises the real issuer/session, SDK values,
TLS listener, executor and engine, without a live provider call. Request rejection
must show zero engine calls. Result tampering, late abort or missing delivery after
admission must show one engine call: failure does not undo execution or refund quota.
The existing HTTPS and default-manifest regressions remain in the normal suite.

The Grant/manifest composition regression prepares two independently valid real
issuer snapshots and checks each matching pair. It then combines Grant A with
manifest B, with the request/context consistently using A's Grant and B's surface.
The SDK rejects the mismatch before transport: zero sends and zero engine calls.
This establishes representation binding, not a new live-authority guarantee.

Run `npm run check`, `npm run build`, `npm run test:coverage`, `git diff --check`.
For a focused reproduction: `npm run test:inline-receipt-pilot`.

Local results: 40 pilot scenarios and all 516 Vitest tests passed; the 6 preflight
and 13 bundle-guard tests also passed. Formatting, lint, TypeScript, production
build/browser isolation and `git diff --check` passed. Coverage passed the existing
gate at 89.68% lines overall (90.65% for `server`). CI status is reported separately
on the pilot PR. No live Codex/provider call was made for this pilot.

## Next decision

Review the pilot before merging SDK PR #40. If the real-host results hold, decide
whether to activate the selected wire in the live backend as a separate focused
change. This pilot intentionally keeps extra adapter glue to compare SDK validation
with native behavior; it is not the final integration API or a boilerplate reduction
claim. Production trust, signed receipts and broader profiles remain separate work.
