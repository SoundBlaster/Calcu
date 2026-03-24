# Next Task: P3-T3 — Build the portrait keypad layout

**Priority:** P0
**Phase:** Phase 3 — Adaptive UI
**Effort:** 3
**Dependencies:** P3-T1, P3-T2, P2-T2
**Status:** Selected

## Description

Implement the portrait keypad as a dedicated component that renders the standard calculator rows from shared key metadata, preserves the bottom-weighted visual rhythm from the reference screenshot, and keeps the operator column visually dominant without ad hoc page-level row markup.

## Why This Task Now

The portrait metadata and button primitives are both in place, which means the remaining work is composition and layout rather than inventing new visual contracts. Even though the engine work is still incomplete, the portrait keypad can be built and verified as a UI layer that later calculator state wiring can consume directly.

## Next Step

Run the PLAN command to create the task PRD for `P3-T3`.
