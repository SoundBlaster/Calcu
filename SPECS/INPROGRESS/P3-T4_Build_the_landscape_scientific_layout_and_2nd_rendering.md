# Task PRD — P3-T4 Build the landscape scientific layout and `2nd` rendering

## Scope

Extend the shared keypad component and preview shell so the app can render the scientific landscape calculator layout from the shared metadata in both normal and `2nd` states. This task should make the landscape keypad visually dense and screenshot-aligned, keep the operator column crisp on wide screens, and expose a clear active treatment for the `2nd` toggle without introducing calculator math logic.

## Deliverables

- updates to `src/features/calculator/components/Keypad.tsx`
- updates to `src/features/calculator/components/Keypad.module.css`
- tests covering landscape row rendering and `2nd`-mode label swaps
- app preview wiring that can render portrait or landscape preview layouts and surface the `2nd` active state in landscape mode

## Dependencies

- P3-T1 scientific key metadata
- P3-T2 display and button primitives
- P3-T3 keypad component foundation
- P2-T4 and P2-T5 engine behavior is still incomplete, so this task must limit itself to UI preview state and layout rendering

## Constraints

- No scientific math execution in this task
- Landscape rows must match the PRD label order exactly in normal and `2nd` modes
- The keypad should remain dense and legible on wide viewports without visually weak buttons
- `2nd` mode must have an obvious active-state treatment
- Portrait layout must keep working after the shared keypad component expands for landscape

## Execution Plan

1. Extend the keypad component API to support landscape rows, active key states, and scientific layout density.
2. Add landscape-specific grid styling for 10-column rows, consistent button rhythm, and operator-column emphasis.
3. Update the app preview so wide viewports render the landscape keypad and allow the `2nd` button to swap the affected scientific labels.
4. Add tests that verify normal and `2nd` landscape rows plus the active-state treatment.
5. Run the quality gates and visually validate both landscape screenshots.

## Acceptance Criteria

- Landscape rows match the PRD in normal and `2nd` modes
- Scientific keys keep stable sizing and spacing across wide viewports
- `2nd` mode has a clear active-state treatment
- Portrait mode remains intact after the shared keypad changes
- Tests pass alongside lint, typecheck, and build validation

## Out of Scope

- Calculator engine execution for scientific actions
- Stateful angle-mode or memory behavior beyond preview rendering
- Final calculator feature composition with a single state model
