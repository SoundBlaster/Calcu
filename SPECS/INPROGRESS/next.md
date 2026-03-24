# Next Task: P3-T1 — Define portrait, scientific, and `2nd` key metadata

**Priority:** P0
**Phase:** Phase 3 — Adaptive UI
**Effort:** 2
**Dependencies:** P1-T4, P2-T1
**Status:** Selected

## Description

Create the data-driven key definition module that describes the portrait keypad plus the landscape scientific keypad in both normal and `2nd` modes. The output of this task should capture labels, visual variants, row placement, wide-key behavior, and stable semantic action identifiers that later engine and keypad work can consume without hard-coding button rows in components.

## Why This Task Now

The project already has layout tokens and button/display primitives, so the next highest-value UI step is to replace the preview-only row literals with a reusable keypad contract. Although the engine action types are not implemented yet, this task can still define a UI-facing metadata layer that stays serializable and narrow enough for the engine contracts to adopt in the next phase.

## Next Step

Run the PLAN command to create the task PRD for `P3-T1`.
