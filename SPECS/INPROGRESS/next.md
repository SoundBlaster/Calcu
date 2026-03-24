# Next Task: P1-T5 — Define layout tokens and base styling contracts

**Priority:** P0
**Phase:** Phase 1 — Foundation and Tooling
**Effort:** 1
**Dependencies:** P1-T4
**Status:** Selected

## Description

Define the shared layout token contract for the calculator UI so spacing, button geometry, radii, display sizing, color roles, and portrait/landscape breakpoints stop living as scattered one-off values. This task establishes the visual foundation that later display, button, and keypad components can reuse without mixing styling rules into calculator logic.

## Why This Task Now

The current scaffold already renders a visual shell, but its key dimensions and color roles are hardcoded inside the preview styles. Because the direction is to start from the visual look rather than calculation logic, the next highest-value task is centralizing those constants into reusable TypeScript and CSS token layers before building real button and display primitives.

## Next Step

Run the PLAN command to create the task PRD for `P1-T5`.
