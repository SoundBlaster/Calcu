# Next Task: P4-T6 — Refine wide `0` key label alignment

**Priority:** P1
**Phase:** Phase 4 — Verification and Polish
**Effort:** 1
**Dependencies:** P3-T5
**Status:** Selected

## Description

Fix the visual drift of the wide `0` key label so the `0` glyph sits directly under the `1` column rather than appearing pushed off because the pill button is wider than the standard digit buttons. The solution should use a shared content-alignment or padding strategy that keeps small buttons visually centered while making the wide button line up with the digit column.

## Why This Task Now

The button primitive task established the current shape and styling contracts, which makes this a focused visual correction instead of a broader component redesign. The issue is already visible in the running preview, so it is efficient to address the alignment contract now before more keypad and layout work layers additional assumptions on top of the current button spacing behavior.

## Next Step

Run the PLAN command to create the task PRD for `P4-T6`.
