# Next Task: P3-T2 — Build the display and button primitives

**Priority:** P0
**Phase:** Phase 3 — Adaptive UI
**Effort:** 1
**Dependencies:** P1-T5
**Status:** Selected

## Description

Implement reusable `Display` and `CalcButton` primitives with CSS Modules and token-driven styling so the calculator stops depending on page-level preview markup. This task should produce stable component contracts for the right-aligned display, circular input/system/operator buttons, and the double-width `0` pill button that later keypad and layout tasks can compose directly.

## Why This Task Now

The repository already has the calculator token system and shared theme layer in place, which removes the largest styling ambiguity. Because the current goal is the visual look of the calculator, the next highest-value move is to replace the single preview shell with reusable primitives that lock in geometry, color roles, interaction states, and display scaling behavior before full portrait and landscape keypad composition.

## Next Step

Run the PLAN command to create the task PRD for `P3-T2`.
