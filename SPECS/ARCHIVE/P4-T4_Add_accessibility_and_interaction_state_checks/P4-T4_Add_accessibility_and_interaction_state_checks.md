# P4-T4: Add accessibility and interaction-state checks

## Goal

Verify that the calculator exposes accessible button semantics, visible focus treatment, and stable interaction-state styling for the button families already in the UI.

## Scope

- Review the semantic structure of `CalcButton`, `Display`, and `Keypad`.
- Confirm that focus, hover, active, and disabled states do not alter button geometry or layout rhythm.
- Add tests only if the verification pass reveals a missing assertion.

## Inputs

- Existing calculator button and display components under `src/features/calculator/components/`.
- Existing component tests covering button structure and keypad rendering.

## Deliverables

- Accessibility verification notes in `SPECS/INPROGRESS/`.
- Component updates or additional tests if a gap is found.

## Acceptance Criteria

- Interactive controls use accessible button semantics.
- Focus visibility is preserved for keyboard navigation.
- Interaction states do not shift button size or layout.

## Dependencies

- P3-T2: Build the display and button primitives.
- P3-T5: Compose the calculator feature and viewport switching.

## Notes

- Prefer documenting the current state when the implementation already satisfies the contract.
- Only touch component code if a concrete accessibility gap is confirmed.
