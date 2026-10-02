# Next Task Queue

## Recently Completed (not yet archived)

- P5-T8A — SDK-authored `0.1.2` candidate and immutable `0.1.1` fixtures;
  [preparation evidence](../../docs/LIVE_SDK_MANIFEST_PREPARATION.md).
  Merged in [Calcu #18](https://github.com/SoundBlaster/Calcu/pull/18).

- P5-T8B — SDK-authored `0.1.2` live selection and bounded host retirement;
  implemented for review, see [activation evidence](../../docs/LIVE_SDK_MANIFEST_ACTIVATION.md).

- Public SDK authoring subpath connected to Calcu's offline candidate;
  merged in [Calcu #16](https://github.com/SoundBlaster/Calcu/pull/16);
  [compatibility and validation report](../../docs/OFFLINE_ACTION_AUTHORING.md).
  No live description or authority migration.

## Next

- P5-T8 — [Live SDK Manifest Migration plan](P5-T8_Live_SDK_Manifest_Migration.md).
  P5-T8A is merged. Review P5-T8B activation/lifecycle evidence and its CI,
  then merge separately. An optional authenticated CLI smoke is separate from
  the deterministic fake-agent/HTTPS gate; retry must review access again.
  Historical baseline: the
  [P5-T7 design and acceptance evidence](../ARCHIVE/P5-T7_Offline_Action_Authoring/P5-T7_Offline_Action_Authoring_Design.md);
  see also the [validation report](../ARCHIVE/P5-T7_Offline_Action_Authoring/P5-T7_Validation_Report.md).

## Recently Archived

- P5-T7 — Bounded Calcu offline action-authoring acceptance spike (PASS; no-go for production adoption on single-action evidence)
- P5-T6 — Validate SDK abstractions with a second small consumer (PASS; representation-level reuse demonstrated, runtime extraction not justified)
- P5-T5 — Adopt ASP SDK manifest/Grant values and server-only receipts (PASS; merged in Calcu PR #6)
- P5-T4 — Verify ASP demo readiness and document adoption (PASS)
- P4-T8 — Establish repository quality gates and CI reporting (PASS)
- FU-T1 — Normalize calculator task IDs against existing archive history (PASS)
- FU-T2 — Re-scope remaining Phase 1 setup tasks after scaffold delivery (PASS)
- P4-T7 — Prevent Enter from double-dispatching focused calculator buttons (PASS)
- P4-T5 — Finalize readiness scripts and developer guidance (PASS)
- P4-T4 — Add accessibility and interaction-state checks (PASS)
- P4-T3 — Verify visual stability across supported viewport sizes (PASS)
- P4-T2 — Write engine tests for standard and scientific behavior (PASS)
- P2-T5 — Implement parentheses handling and display formatting (PASS)
