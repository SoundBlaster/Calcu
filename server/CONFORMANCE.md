# P5-T4 boundary/conformance report

This report maps the local executable slice to the ASP Mediated Proposal roles.
It is a diagnostic report for Calcu development and is not an ASP certification
claim.

| Role | Calcu implementation | Executable evidence | Status |
| --- | --- | --- | --- |
| Surface Publisher | `surface` in `executor.ts` | Fixed `proposal_only` snapshot, action/scope and JCS surface hash assertions | Local snapshot only; no discovery endpoint |
| Grant Issuer | `executor.issue()` | Closed request, identity verification, Grant hash, subject/delegate/audience and expiry tests in `boundary.test.ts` | Compatibility Bearer development profile |
| Action Executor | `executor.invoke()` | Independent grant/session/identity/action/schema/quota admission and `engineCalls === 0` rejection assertions | Implemented for one proposal action |
| Runtime Mediator | `createLocalBackend()` and `transport.ts` | Typed request construction, no body credential, exact response correlation and HTTPS integration tests | Loopback HTTPS only |
| Agent Adapter | `CodexTaskAdapter` plus LocalBackend facade | Pinned CLI protocol/model/effort, closed dynamic tool, exact call correlation, one successful call, process cleanup and fake-process/real-HTTPS integration tests | Live provider smoke is manual; app identity does not attest the Codex binary |
| Receipt Producer | — | No receipt tests or signing implementation | Not implemented; planned separately |
| Human Approval | — | No approval artifact or approval UI | Not implemented; planned separately |

## Negative coverage

The tests exercise missing/foreign/expired/revoked credentials, lifecycle
states, unsupported identity profiles, subject/runtime/agent/audience and hash
mismatches, stale session generations, action/mode/input substitution, body
credentials, malformed JSON, HTTP/host/path/method/content-type errors, invalid
TLS, redirects, oversized request/response, timeout, abort, quota exhaustion
and forged/correlation-mismatched results. The application engine call count is
checked for rejection paths.

Adapter and browser-host tests additionally cover malformed/truncated JSONL,
unknown server requests, wrong thread/tool identifiers, absent/duplicate tool
calls, untrusted fabricated prose, nonzero exit, timeout, cancellation, exact
Host/Origin/cookie checks, oversized/extra task input, concurrency and closed
error projection. The UI requires a correlated tool-result event before rendering
terminal success and ignores events from cancelled/replaced client generations.
It also keeps the immutable submitted task separate from the exact admitted
action and labels model prose as unverified. This provenance presentation does
not establish semantic equivalence between the request and the action.

## Manual live evidence

On 2026-09-05, `npm run agent:demo` was run with authenticated Codex CLI
`0.145.0`, model `gpt-5.6-luna` and effort `low`. The live task called
`calculation_propose` once and the application returned `240 × 0.15 = 36` through
the loopback HTTPS executor. This verifies the local demo wiring only; it is not
CI evidence, independent interoperability, or production conformance.

## Explicit non-claims

The slice does not provide production identity trust, durable user consent,
Proof-Bound DPoP/mTLS, portable receipts, recovery, replay protection beyond
the local correlation contract, remote networking, CORS integration, or a
general-purpose ASP SDK. It does not parse natural-language intent or prove that
an admitted action fully represents a user's task. The ASP repository and
normative text remain unchanged.

## Adoption verification

P5-T4 adds a post-build browser-bundle check for known server-only Grant,
identity, session, bearer-header, and private-key markers. CI now runs the real
production build and this check before the deterministic test suite. This guard
supports, but does not replace, the server/client architecture and negative
boundary tests.

Reproduction steps, implementation cost, limitations, rendered layout evidence,
and the recommended SDK extraction path are recorded in the
[Calcu ASP adoption report](../docs/ASP_ADOPTION_REPORT.md).
