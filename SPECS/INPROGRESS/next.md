# Next Task: P3-T5 — Compose the calculator feature and viewport switching

**Priority:** P0
**Phase:** Phase 3 — Adaptive UI
**Effort:** 5
**Dependencies:** P2-T3, P2-T5, P3-T3, P3-T4
**Status:** Selected

## Description

Compose the actual calculator feature from the shared display, keypad, metadata, and viewport logic so portrait and landscape layouts share one stateful model. This task should replace the preview-only shell with a usable calculator that preserves its value and UI mode when the viewport changes, while keeping all button behavior routed through a dedicated model layer instead of embedding math logic in React components.

## Why This Task Now

Both keypad layouts now exist and the remaining Phase 3 work is integration: state, viewport switching, and feature composition. The Phase 2 engine tasks are not archived yet, but a focused model layer can still be added here to power standard calculator interactions and UI modes so the feature becomes genuinely usable while staying aligned with the longer engine roadmap.

## Next Step

Run the PLAN command to create the task PRD for `P3-T5`.
