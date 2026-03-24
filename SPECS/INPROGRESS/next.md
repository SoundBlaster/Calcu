# Next Task: P3-T4 — Build the landscape scientific layout and `2nd` rendering

**Priority:** P0
**Phase:** Phase 3 — Adaptive UI
**Effort:** 4
**Dependencies:** P3-T1, P3-T2, P2-T4, P2-T5
**Status:** Selected

## Description

Extend the keypad system to render the landscape scientific calculator layout, including the 10-column row structure, the alternate `2nd`-mode labels, and a clear active-state treatment for the `2nd` toggle. The layout should stay visually dense and stable on wide viewports while preserving the existing portrait keypad behavior.

## Why This Task Now

The portrait keypad component now exists, which makes it practical to widen that shared composition layer for landscape rather than building a second one-off layout surface. Although the scientific engine behavior is still incomplete, the landscape keypad and `2nd` label treatment can be built and visually validated as a UI contract that later state wiring will reuse.

## Next Step

Run the PLAN command to create the task PRD for `P3-T4`.
