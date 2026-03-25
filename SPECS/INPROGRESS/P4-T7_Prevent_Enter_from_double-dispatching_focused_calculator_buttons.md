# P4-T7: Prevent Enter from double-dispatching focused calculator buttons

## Goal

Ensure the global calculator keyboard handler does not duplicate native button activation when `Enter` is pressed on a focused calculator button.

## Scope

- Guard the keyboard listener so focused calculator buttons do not receive a second reducer dispatch from the global shortcut path.
- Add regression coverage proving the focused-button Enter path still yields a single calculator action.

## Inputs

- Existing calculator keyboard hook and keyboard mapping helper under `src/features/calculator/lib/`.
- Existing calculator integration tests under `src/features/calculator/components/`.

## Deliverables

- Keyboard listener guard updates.
- Regression test coverage for the focused-button Enter path.
- Validation report documenting the fix.

## Acceptance Criteria

- Pressing `Enter` on a focused calculator button triggers a single calculator action.
- Global keyboard support remains available for shortcuts when no interactive control should handle the key.
- Regression coverage proves the focused-button path does not double-dispatch.

## Dependencies

- P4-T1: Add keyboard input handling.

## Notes

- Keep the guard narrowly scoped to the focused-button Enter case.
- Preserve the existing global keyboard mapping for non-button shortcut events.
