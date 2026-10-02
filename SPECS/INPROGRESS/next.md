# Next Task Queue

## Recently Completed (not yet archived)

- P5-T8A — SDK-authored `0.1.2` candidate and immutable `0.1.1` fixtures;
  [preparation evidence](../../docs/LIVE_SDK_MANIFEST_PREPARATION.md).
  Merged in [Calcu #18](https://github.com/SoundBlaster/Calcu/pull/18).

- P5-T8B — SDK-authored `0.1.2` live selection and bounded host retirement;
  merged in [Calcu #19](https://github.com/SoundBlaster/Calcu/pull/19) as
  `ee4681f1df73a75611a9c348162714a5b750c7cb` with green verify/coverage CI;
  see [activation evidence](../../docs/LIVE_SDK_MANIFEST_ACTIVATION.md).

- Public SDK authoring subpath connected to Calcu's offline candidate;
  merged in [Calcu #16](https://github.com/SoundBlaster/Calcu/pull/16);
  [compatibility and validation report](../../docs/OFFLINE_ACTION_AUTHORING.md).
  No live description or authority migration.

## Next

- P5-T9A characterization and P5-T9A-F dispatch deadline/input repair merged in
  Calcu #20/#21; [repair evidence](../../docs/DISPATCH_INPUT_REPAIR.md).
  P5-T9A completed with no-go for public extraction/live adoption: at its baseline,
  a Grant or identity deadline could elapse inside verification before function
  entry, and mutable caller input could invalidate an otherwise correct response.
  Those bounded consumer gaps are corrected at merged `3ae557d`. SDK #34 merged
  the host-owned dispatch design. Selected next:
  [P5-T9A-H private real-host comparison](P5-T9A-H_Private_Host_Comparison.md),
  with paired actual HTTPS paths and measured binding cost before selecting
  any public dispatch interface.
  See the [binding task](P5-T9_Admitting_Handler_Binding.md).
  P5-T8A/B are merged. An optional authenticated CLI smoke remains separate from
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
