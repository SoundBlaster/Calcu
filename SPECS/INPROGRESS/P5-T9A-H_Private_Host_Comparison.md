# P5-T9A-H — Private real-host binding comparison

Status: implemented and locally verified, 2026-10-02 UTC; pending PR/CI/merge.
Complexity: high; reasoning effort: high.
The [comparison report](../../docs/PRIVATE_HOST_BINDING_COMPARISON.md) records
32 paired/preparation cases and no-go for this public wrapper; P5-T9B/C remain gated.
Baseline: merged Calcu #20/#21, `3ae557dfbf5bf5973601155261c4f060ec3ee46e`.
The [SDK host-owned dispatch design](https://github.com/0al-spec/agent-surface-js/blob/e67c834e5850c8b88f65964e0c1dafc70df93e30/docs/plans/host-owned-proposal-dispatch.md)
defines the intended ordering and sampled-time limitations. P5-T9B/C remain gated.

## Scenario

Compare Calcu's native one-line function connection with a private explicitly
prepared handler binding. Both run through the unchanged real executor,
LocalBackend, loopback HTTPS, identity, Grant, receipt and exposure checks.
The question is whether this binding actually removes integrator work, not
whether wrapping a function is possible.

## Plan and boundary

1. Capture an explicit action/mode/snapshot selection and native synchronous
   calculation callback in a test-only binding. Preparation verifies description
   consistency, executes nothing and issues nothing. It is not an admission API.
2. Use a Vitest-only replacement at the existing `calculate(input)` import to
   compare native and candidate connections, keeping the actual executor owner
   of all lifecycle checks, quota and entry. Do not add production options,
   duplicate an executor or change the live host composition.
3. Run paired real-HTTPS vectors for success, invalid input, expiry, revocation,
   rotation, retirement, cancellation, input custody, quota and rejected output.
   Count executor entry separately from accepted result/receipt presentation.
4. Record retained obligations, additional binding cost and go/no-go. Test-only
   composition is not a public adapter, independent implementation or interop.

Deadline eligibility uses the final returned time sample; it does not promise
physical entry before wall-clock expiry. External status writers and clock
rollback qualification remain unresolved for general SDK extraction.

## Gates and outcome

Run `npm run check`, `npm run build`, `npm run test:coverage`, `git diff --check`.
Preserve the one-action/four-operation surface, wire/hash views, vendored SDK
artifact, browser UI and live Codex settings. No live model request is needed.

If only one function call is wrapped, no production glue is removed and host
setup remains mandatory, record no-go for public extraction. Do not promote this
fixture or add an execution API just to make the experiment look successful.
