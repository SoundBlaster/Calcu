# P4-T1: Add keyboard input handling

## Goal

Implement desktop keyboard support for the calculator feature using the existing reducer-backed engine path. Keyboard input must dispatch the same actions as button input and preserve calculator state across key presses.

## Scope

- Add a keyboard input handler module or hook for the calculator feature.
- Wire the handler into `Calculator.tsx`.
- Support the PRD desktop keyboard mapping for digits, decimal, operators, equals, escape, and backspace.
- Keep the handler UI-focused; do not embed calculator math in the keyboard layer.

## Inputs

- Existing reducer-driven calculator state and dispatch flow.
- PRD keyboard mapping in `SPECS/PRD.md` section 6.13.

## Deliverables

- Keyboard handler module or hook under `src/features/calculator/`.
- Updates to `src/features/calculator/components/Calculator.tsx`.
- Tests that prove keyboard events dispatch the expected actions and backspace behavior follows the PRD rules.

## Acceptance Criteria

- `0-9` map to digit input.
- `.` maps to decimal input and uses the calculator engine path that produces the UI separator.
- `+`, `-`, `*`, and `/` map to the correct binary operators.
- `Enter` and `=` resolve the current expression.
- `Escape` clears the calculator state through the existing all-clear action.
- `Backspace` deletes the last active digit, becomes `0` when one digit remains, and is ignored after a resolved result when no new entry has started.
- Keyboard input does not bypass the reducer or duplicate engine logic in the component.

## Dependencies

- P3-T5: Compose the calculator feature and viewport switching.
- P2-T2: Implement standard arithmetic state transitions.

## Notes

- Prefer a small, testable translation layer from `KeyboardEvent` to calculator action IDs.
- Keep the handler resilient to non-printable keys and modifier combinations that should not affect calculator input.

---
**Archived:** 2026-03-25
**Verdict:** PASS
