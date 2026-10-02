# P5-T9A — Admission to native function characterization

Date: 2026-10-02 UTC. Baseline: Calcu #19 merge
`ee4681f1df73a75611a9c348162714a5b750c7cb`. Production source is unchanged.
The [task](../SPECS/INPROGRESS/P5-T9_Admitting_Handler_Binding.md) and
[SDK qualification report](https://github.com/0al-spec/agent-surface-js/blob/codex/admitting-handler-binding-plan/docs/reports/admitting-handler-binding-qualification.md)
scope a private experiment, not a consumer migration or conformance promotion.

## Admission obligation map

| Stage / owner | Observable prerequisite | Evidence |
| --- | --- | --- |
| Executor credential lookup / host state | Exact private credential record, active Grant/session, initial expiry | `server/boundary.test.ts` missing/foreign/revoked/expired/session cases |
| Executor raw boundary | 8 KiB, strict JSON, duplicate/numeric/closed-field rules | `server/boundary.test.ts` malformed, extra, oversized cases |
| Identity verifier / host policy | Current evidence status/hash/freshness | `server/boundary.test.ts` legacy-domain, unsupported/status cases |
| Executor selected Grant / snapshot | Semantic request and selected Grant validate/hash; exact subject/delegate/audience/session/action/mode | `server/boundary.test.ts`; `server/liveActivation.test.ts` selected snapshot/restart |
| Manifest + application domain | Input schema, execution/input hashes, finite four-operation inputs | `server/boundary.test.ts`, `server/sdk-manifest.test.ts` |
| Executor receipt verification | Runtime Receipt and parent link match independent expected context | `server/boundary.test.ts` tampering, missing receipt, policy hash |
| Final executor dispatch | Re-read retirement/active/cancel; claim shared quota; increment `engineCalls`; call `calculate(input)` | New characterization plus existing live retirement vectors |
| Application + result boundary | Arithmetic, output schema, App Receipt, disclosure serialization | Boundary and exposure suites; invalid output counts as entry |
| LocalBackend presentation | Correlation, echoed inputs, output hash, App Receipt; post-execution cancellation | Boundary/live suites and new characterization |

`engineCalls` counts function entry, not successful mathematical evaluation or
accepted UI result. For a rejecting request compare the count before/after;
existing cases that first capture a successful request legitimately start at 1.

## New observations

[11 characterization tests](../server/handlerBindingCharacterization.test.ts)
exercise the unmodified executor and LocalBackend:

1. Re-entrant revoke, session rotation, retirement and cancellation inside the
   identity verifier reject with **zero** engine calls.
2. A Grant valid at request entry but expired by verifier return still permits
   **one** engine call. The following request is rejected. This is a confirmed
   dispatch-time deadline gap, not a passing security invariant.
3. Identity freshness valid against the initially captured clock but expired
   by verifier return also permits **one** engine call. The following request
   rejects. The test wraps the trusted verifier to return a shorter freshness
   bound; it does not forge an untrusted Passport or change identity evidence.
4. Expiry already present at request entry rejects before execution.
5. Competing requests from recreated mediators share the final quota slot;
   the executor allows at most its three configured calls.
6. Caller mutation during verification leaves the serialized request and engine
   operation unchanged, but LocalBackend compares the response against its
   retained caller object and rejects `invalid_response`. One function call
   occurred; only a Runtime Receipt is accepted by the mediator.
7. Invalid mathematical output consumes quota; cancelled delivery after entry
   does not become successful presentation or undo the call.

The two known-gap tests deliberately assert observed baseline success and are
labelled as such. They must be replaced by zero-entry regression expectations
with the correction; green characterization does not mean the gaps are fixed.

## Decision / follow-up

P5-T9A delivered its experiment and **no-go for public SDK extraction/live
adoption**. The private SDK model demonstrates a synchronous dispatch fence
and a separate greeting manifest, not the complete ASP executor. Moving the
existing one-line native callback behind another admission system has not yet
shown a real integration saving. Production Calcu, SDK pin/archive, surface
`0.1.2`, authority, receipts, task API and browser behavior remain unchanged.

Next is **P5-T9A-F — dispatch deadline and mediator snapshot repair**:

- Read the trusted clock again immediately before dispatch; reject non-finite
  time, elapsed Grant expiry and elapsed verified-identity freshness.
- After that clock callback, recheck current active/retired/session generation
  and cancellation before the synchronous quota claim/function entry.
- Capture LocalBackend input in a new owned object before request construction;
  use that immutable snapshot for hashes and response comparison. Do not freeze
  the caller's object or relax echoed-input/receipt checks.
- Replace the known-gap tests, add mutation after transport suspension and clock
  callback re-entry vectors, rerun real HTTPS/boundary/lifecycle checks.

That correction is explicitly **not implemented in this characterization PR**.
No production identity, async/durable effects, natural-language intent proof,
ADP status or RFC maturity claim is made.
