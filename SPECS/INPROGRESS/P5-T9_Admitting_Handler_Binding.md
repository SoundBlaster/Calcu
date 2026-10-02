# P5-T9 — Qualify an admitting executor to handler binding

Status: P5-T9A private qualification completed, 2026-10-02 UTC; no-go for public
extraction/live adoption. See the [characterization report](../../docs/HANDLER_BINDING_CHARACTERIZATION.md).
P5-T9A-F dispatch deadline and mediator snapshot correction is next; production
behavior is unchanged in this stage. P5-T9B/C remain gated.
Priority: P1. Complexity: high; reasoning effort: high.
Baseline: P5-T8B merged in [Calcu #19](https://github.com/SoundBlaster/Calcu/pull/19)
as `ee4681f1df73a75611a9c348162714a5b750c7cb` with successful verify/coverage CI.

The companion [SDK design](https://github.com/0al-spec/agent-surface-js/blob/codex/admitting-handler-binding-plan/docs/plans/admitting-handler-binding.md)
owns the proposed mechanism and qualification matrix. Calcu's workplan owns
consumer sequencing; the [ASP adoption backlog](https://github.com/0al-spec/agent-surface/blob/main/review/adoption-delivery-backlog.md)
owns canonical ADP status. This task does not unblock or complete those ADP tasks.

## Scenario and intended result

A developer connects Calcu's existing arithmetic function to the one declared
`calculation.propose` action. The SDK should help maintain this typed binding
without requiring per-operation copies of admission or infrastructure setup.
The current four-operation native calculator remains useful on its own.

Every ASP invocation still traverses LocalBackend → HTTPS → independent
application admission → arithmetic function. Registering a handler neither
issues a Grant nor makes the function an agent-facing tool bypass.

## Delivery

### P5-T9A — Characterization and private contract fixture

- Inventory the exact `server/executor.ts` checks from credential lookup through
  the final current-state/quota check and `calculate(input)` entry. Reuse the
  boundary, receipt, quota and retirement vectors rather than duplicating them.
- Observe expiry/generation/revocation/cancellation at dispatch, including
  synchronous verifier re-entry and clock advancement. Count handler entry
  separately from successful result presentation.
- Qualify the proposed private SDK seam with immutable admitted inputs and
  exact action/snapshot/schema binding. A prior validation result or a caller
  `admitted: true` flag cannot authorize execution.
- Compare against a separate non-arithmetic proposal fixture; measure binding,
  host/policy setup, SDK engineering and test code separately.
- Deliver a go/no-go report before selecting public signatures. Production
  Calcu, SDK exports/source lock, surface hashes and vendored archive remain
  unchanged during this characterization stage.

### P5-T9B — Public SDK slice and packed consumer qualification

Only a passing P5-T9A candidate with sufficient state semantics and measured
benefit qualifies. Add a focused server execution module, keeping offline
authoring handler-free. Qualify the packed API and browser/model import boundary.
If a broader authoritative-store contract is required, scope it first; do not
substitute an in-memory cache for mandatory durability or copy the whole executor.

### P5-T9C — Calcu adoption

After the reviewed public SDK slice lands, pin its package artifact and replace
only the qualified binding mechanics. Preserve host-owned identity/consent,
credential custody, Grant/session/quota state, receipts and business rules.
Run the actual fake-Codex → HTTPS → Calcu path and all existing negative cases.
If wire/resource content changes, use a separate version/authority transition
decision; reusing a version label does not justify a different hashing view.

## Acceptance and limits

Success requires a documented dispatch point, zero handler calls for admission
rejection, one call for a valid proposal, quota persistence, immutable input and
accurate reporting when invalid output or cancellation follows execution. It
also requires evidence that preparation cannot execute a handler or create
authority. Types do not prove that trusted handler code obeys its effect metadata.

The initial handler is synchronous and non-persisted. This task does not select
async effects, multiple live actions, signed/durable receipts, production
identity, Proof-Bound transport or natural-language intent verification.
The existing Compatibility Bearer loopback demo remains the bounded consumer.

Run relevant characterization tests for P5-T9A. SDK implementation must pass
its check/build/pack gates; Calcu adoption must pass check/build/coverage and
`git diff --check`. Record all dates in UTC. Stop after meaningful CI dispatch
and report results without polling unchanged runs.
