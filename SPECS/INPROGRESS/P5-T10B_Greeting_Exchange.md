# P5-T10B — Second consumer and JSON value comparison

Status: implemented and locally verified, 2026-10-02 UTC; pending PR/CI/merge.
Complexity: medium; reasoning effort: high.
Base: [Calcu #23](https://github.com/SoundBlaster/Calcu/pull/23),
`61da8f2fdda8c1865747e8cfb8ab5ccad47fcf51`; separate stacked follow-up.
Evidence: [qualification and compatibility report](../../docs/GREETING_EXCHANGE_QUALIFICATION.md).
169 targeted cases, 512 total Vitest tests, check/build/coverage pass.

## Scenario and plan

1. Keep a native Greeting application independent of ASP. Its list of recipients
   and nested style exercise different data from Calcu's three scalar inputs.
2. Compose it with the same private proposal exchange, its own closed schemas
   and an explicitly synthetic evidence policy. Exercise a separate loopback
   HTTPS test host, not Calcu's executor or receipt verifier.
3. Compare strictly parsed JSON values using JCS object ordering. Preserve array
   order and exact string values. Record the intentional difference from the
   production LocalBackend's property-order-sensitive comparison.
4. Test schema/evidence/correlation rejection, immutable nested input, bounded
   test-lease lifecycle and cancellation. Count native handler entry separately
   from accepted results. Run local check/build/coverage and create a stacked PR.

## Acceptance and limits

- The same private mechanism serves Calcu and Greeting without domain branches.
- Reordered object members are accepted; changed values, extra members, reordered
  arrays, Unicode normalization and omitted fields are not silently equated.
- Greeting input/output validation and evidence policy remain consumer-owned.
- The test host has its own handler and synthetic lease; it is **not** a second
  independent ASP implementation, Grant Issuer or identity verifier. Its evidence
  objects are explicitly test-only, not conforming Runtime/App Receipts.
- Real TLS does not upgrade those fixtures to production trust infrastructure.
- Production Calcu, the public SDK, RFC, source lock, UI and model stay unchanged.
- Public extraction remains gated on a selected envelope/extension contract and
  packed-package/import-boundary qualification. Do not invent a profile here.
- No live model request, merge, automatic retry or general executor is included.
