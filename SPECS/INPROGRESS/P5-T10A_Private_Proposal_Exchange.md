# P5-T10A — Private request/result exchange qualification

Status: implemented and locally verified, 2026-10-02 UTC; pending PR/CI/merge.
Complexity: medium; reasoning effort: high.
Baseline: P5-T9A-H in [Calcu #22](https://github.com/SoundBlaster/Calcu/pull/22),
head `07edaf33fbf5b1939d586984a55637b4b84310d1`; this is a separate stacked slice.
The [contract and comparison report](../../docs/PRIVATE_PROPOSAL_EXCHANGE.md)
records 126 targeted tests, 169 → 82 facade lines, total implementation cost
and the remaining portable-contract/consumer qualification before public API.

## Scenario

The application already owns a Grant/session binding and a validated calculation.
A private reusable value assembles one proposal request and checks that the
application response belongs to that exact invocation. Calcu continues to own
credentials, transport, receipts/policy, domain output checks and independent
executor admission. The experiment measures removed application glue separately
from reusable implementation, host setup and qualification code.

## Plan

1. Specify the exact supported request/result fields against SDK source lock
   `da550fde6f8be4ff0c1ded15524afb66c2912287`. Mark Calcu-specific echoes, inline
   receipts and limits explicitly; do not promote this envelope to an ASP profile.
2. Implement a private immutable proposal exchange under test fixtures. It uses
   existing SDK JSON/hash primitives; constructors only capture inputs. Explicit
   preparation snapshots input/context before calling a trusted receipt producer.
3. Compose a smaller test-only Calcu facade with the unchanged receipt policy,
   real HTTPS transport and real executor. Compare against the production facade
   for valid output, tampering, lifecycle rejection, quota, cancellation and input
   custody. Report handler entry separately from result acceptance.
4. Record the actual cost and decide whether a further independent consumer
   qualification is warranted. Run check, build, coverage and diff hygiene; push
   a focused PR without waiting for remote CI or merging it.

## Acceptance

- A valid call returns `240 × 0.15 = 36` through real TLS and one engine entry.
- A recorded baseline request can be reconstructed with the same selected IDs,
  input and host-produced receipt, preserving its wire representation and hashes.
- Runtime receipt production and application receipt verification remain explicit
  host behavior. Generic result correlation cannot certify receipt authenticity,
  current authority, business correctness or natural-language intent.
- Malformed, duplicate-key, oversized, extra-field, stale or mismatched results
  do not reach the host result reader. Domain and receipt mismatches remain
  rejected by Calcu, including after a real engine call.
- Revocation, generation, identity/Grant expiry and quota checks remain in the
  real executor. Recreating the facade never resets quota.
- Input and request expectations cannot change through caller or callback aliases.
- Cancellation before send yields zero entries; cancellation after entry does
  not refund quota or establish zero execution.
- No production imports, public SDK exports, manifest, Grant/session wire fields,
  source lock, vendored SDK archive, task UI or model settings change.

## Scope

One synchronous, non-persisted `propose` action and successful application result;
transport errors retain the current adapter behavior. No retry engine, durable
receipt store, signed receipts, async effects, Proof-Bound profile or public API
is included. A private representation test using another action name does not
constitute another live application or interoperability evidence.
