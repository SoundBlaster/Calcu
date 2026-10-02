# P5-T9A-H — Real HTTPS host binding comparison

Date: 2026-10-02 UTC. Baseline: Calcu `3ae557dfbf5bf5973601155261c4f060ec3ee46e`.
Decision: **no-go for publishing or adopting this handler-binding wrapper**.
This completes the bounded [private comparison](../SPECS/INPROGRESS/P5-T9A-H_Private_Host_Comparison.md),
not P5-T9B/C, a general SDK executor or a new conformance claim.

## What the comparison actually exercises

[32 tests](../server/hostDispatchComparison.test.ts) run paired baseline and
candidate connections through the real LocalBackend → loopback HTTPS → Calcu
executor. TLS uses a temporary certificate with SAN for `127.0.0.1`, explicitly
trusted by the client with `rejectUnauthorized: true`. Fixtures close their
servers, retire their executors and remove their own temporary TLS directories.
No live model request or production credential is needed.

The private [57-line binding](../server/fixtures/explicitCalculationBinding.ts)
checks explicit action/mode/hash consistency against the host-selected prepared
description, then returns the captured trusted native function. Preparation
neither calls that function nor issues authority. It does not independently
prove provenance of arbitrary caller-made prepared objects: it receives the
actual trusted Calcu preparation, not a public untrusted preparation API.

Vitest replaces only the existing `calculate(input)` import in this test file.
Both paths execute the real arithmetic function. All production executor state,
identity/Grant/hash/schema checks, quota claim, receipt creation and disclosure
remain unchanged. The mock substitutes neither admission nor transport nor
application output. No live source imports the fixture; the returned callback
belongs only to the trusted test host and must never be exposed as a tool.

This establishes behavior at the selected native function connection. It does
**not** implement or qualify a new authority adapter: the concrete host-owned
dispatch sequence is still Calcu's existing closure. External identity-status
ordering, clock rollback, durable effects/recovery and public module packaging
remain outside the experiment. The SDK source lock and vendored package remain
unchanged; authoring remains handler-free.

## Paired observations

| Scenario | Both real-host paths |
| --- | --- |
| `240 × 0.15` | One executor/native entry, correlated `36`, accepted Runtime and App Receipts |
| Grant or verified-identity deadline at returned dispatch sample | Zero entries, rejected request |
| Re-entrant revoke/rotate/retire during verification | Zero entries |
| Revoke from final clock callback | Zero entries after lifecycle recheck |
| Pre-aborted client request | No request sent and zero entries |
| Client abort during synchronous server verification | Client rejects; server enters once before observing socket closure; quota not refunded |
| Time sampled before deadline, simulated elapsed time before native entry | One entry; receipt uses returned sample; next expired request rejects |
| Caller input mutated during verification | Original operation is executed/verified; caller remains mutable |
| Caller requests `sqrt` | Rejected; no additional native entry and no surface expansion |
| Division by zero, then recreated mediator | Entries count despite rejected output; HTTP safely projects `action_rejected`; original quota eventually exhausts |
| Cancelled delivery or substituted response operands | One completed entry; no accepted App Receipt; quota remains consumed |

Preparation has four additional cases: inert valid binding and wrong action,
mode or surface hash, with no callback entry. Existing broader boundary,
fake-Codex, identity, transport and activation suites are reused rather than
copied into this comparison.

Local validation: `npm run check` passed (343 Vitest cases, 6 preflight and
13 browser-boundary cases), `npm run build` passed with browser isolation,
`npm run test:coverage` passed at 88.56% lines (80% gate), and `git diff --check`
passed. All 39 local file links across the six changed documents resolve.
This includes the fixture in the configured coverage inventory; it is not a
production-readiness metric. PR CI must independently validate the pushed head.

### Deadline and cancellation lessons

The deadline case is a deterministic clock model: the clock captures its sample,
then simulated time advances during its callback tail. It is not a timing
benchmark or proof of an OS scheduling interval. It demonstrates the contract's
sampled-time limitation: `t_dispatch` decides deadline eligibility, not physical
wall time at native entry. This matches the corrected
[SDK design](https://github.com/0al-spec/agent-surface-js/blob/e67c834e5850c8b88f65964e0c1dafc70df93e30/docs/plans/host-owned-proposal-dispatch.md).

Likewise, a client AbortSignal and the server's request AbortSignal are distinct.
A socket event cannot interrupt a synchronous server turn already in progress.
Zero-entry cancellation requires cancellation observed before dispatch; closing
the client request is not evidence of that observation. If the action entered,
failed presentation neither undoes the action nor refunds its quota. The
four-operation non-persisted proposal remains appropriate for this demo; this
observation does not authorize asynchronous or destructive actions.

The initial red run exposed two incorrect test expectations, not new production
changes: it expected instantaneous client-to-server cancellation and the internal
`invalid_result` instead of the existing safe HTTP `action_rejected` projection.
The corrected tests preserve those actual boundaries explicitly.

## Cost and decision

Physical source lines include comments/blanks and are separated by ownership:

| Category | Baseline → candidate cost |
| --- | --- |
| Native executor connection | Same one-line `calculate(input)` call; zero removed lines |
| Per-binding preparation | Additional explicit action/mode/hash selection plus `prepare()`; test composition selects it once |
| Private mechanism | 57 new lines, not exported or shipped into a new SDK module |
| Comparison tests | 355 lines, including TLS setup, test-only import substitution and paired cases |
| Host/policy/admission setup | Unchanged, mandatory; no credential, Grant, session or quota ownership transferred |
| Production migration | Zero changed production lines; live demo continues using the native connection |

This candidate proves that explicit description binding can be added without
replacing independent admission. It removes no application integration work and
does not qualify a reusable dispatch owner. Returning a trusted callback is not
an agent-safe executor API. Publishing this wrapper now would add surface area
and setup, not simplify Calcu. **Keep the native binding; do not advance P5-T9B/C.**

Do not extrapolate savings for a second action from this one-action comparison.
The earlier greeting fixture is representation/private-model reuse only, not a
second real application execution adapter.

Next select a concrete repeated integration burden (for example typed
request/result assembly or common boundary validation), inventory which checks
are reusable versus host-owned, and compare a private candidate before adding
public API. Do not automatically copy the 683-line executor into the SDK or
create a second authority path to obtain an apparent line-count reduction.
