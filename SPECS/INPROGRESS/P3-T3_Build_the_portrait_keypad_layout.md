# Task PRD — P3-T3 Build the portrait keypad layout

## Scope

Build a reusable portrait keypad component that renders the standard calculator layout from shared key metadata instead of page-local row literals. This task should turn the current preview into a screenshot-aligned portrait composition with stable row spacing, a dominant operator column, and the double-width `0` pill integrated through component-driven layout rather than one-off page markup.

## Deliverables

- `src/features/calculator/components/Keypad.tsx`
- `src/features/calculator/components/Keypad.module.css`
- component tests covering portrait row rendering, wide-key treatment, and semantic button output
- updated feature exports and app preview wiring so portrait mode renders through the new keypad component

## Dependencies

- P3-T1 portrait key metadata
- P3-T2 display and button primitives
- P2-T2 calculator engine behavior is not implemented yet, so this task must stay UI-only and use inert button handlers or callback props rather than embedding arithmetic

## Constraints

- No calculator logic or state transitions in this task
- No landscape scientific layout yet
- Portrait layout must match the provided screenshot structure and spacing more closely than the current page-level preview
- The `0` key must remain a pill that spans two columns without breaking grid rhythm
- The operator column must remain visually dominant and vertically aligned
- The component API should be suitable for later feature composition in `P3-T5`

## Execution Plan

1. Define the `Keypad` component API around shared key rows and optional button interaction props.
2. Add portrait-focused keypad styling that preserves the standard four-column rhythm, bottom weighting, and operator emphasis from the reference.
3. Refactor the app preview to render the display and keypad through the new component instead of inline row markup.
4. Add tests that verify portrait labels, operator/system variants, and the double-width `0` treatment.
5. Run the quality gates and perform visual QA against the portrait screenshot.

## Acceptance Criteria

- Portrait layout matches the screenshot structure with a dedicated keypad component
- The operator column remains visually dominant in portrait mode
- The `0` key renders as a pill without breaking the grid rhythm
- The keypad renders from shared metadata rather than hard-coded page rows
- Tests pass alongside lint, typecheck, and build validation

## Out of Scope

- Landscape scientific rendering
- Calculator engine dispatch
- Viewport switching
- Keyboard input
