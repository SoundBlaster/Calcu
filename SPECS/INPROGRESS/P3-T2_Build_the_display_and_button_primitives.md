# Task PRD — P3-T2 Build the display and button primitives

## Scope

Implement reusable `Display` and `CalcButton` primitives for the calculator feature using React, TypeScript, and CSS Modules. This task should replace the page-level preview-only UI approach with stable component contracts that preserve the calculator’s visual hierarchy, right-aligned display behavior, circular button geometry, and the double-width `0` pill treatment required by the PRD.

## Deliverables

- `src/features/calculator/components/Display.tsx`
- `src/features/calculator/components/Display.module.css`
- `src/features/calculator/components/CalcButton.tsx`
- `src/features/calculator/components/CalcButton.module.css`
- Component tests covering visual-role and accessibility-facing behavior
- Updated component exports and app preview wiring so the primitives are exercised in the running app

## Dependencies

- P1-T5 layout tokens and shared theme contract

## Constraints

- No calculator engine or arithmetic behavior in this task
- No CSS-in-JS
- No Tailwind
- Styling must stay token-driven and consistent with the current calculator theme
- Display text must remain right-aligned and support safe scale-down without clipping the layout rhythm
- Buttons must support system, input/scientific, and operator visual variants without per-screen one-off styling
- The `0` key pill treatment must be expressible through the button primitive contract

## Execution Plan

1. Define the public component APIs for `Display` and `CalcButton`, including variant and wide-button support.
2. Add CSS Module styling for display alignment, overflow protection, button geometry, and subtle interaction states.
3. Refactor the app preview to render through the new primitives instead of bespoke page-level spans.
4. Add tests that verify label rendering, semantic button behavior, variant mapping, and wide-button state.
5. Run the project quality gates and visually verify that the primitive-based preview still matches the portrait calculator hierarchy.

## Acceptance Criteria

- `Display` renders a right-aligned calculator value with styling that supports long-value scale-down behavior
- `CalcButton` supports system, input/scientific, and operator variants with stable geometry and centered labels
- `CalcButton` supports a wide mode suitable for the `0` pill button without breaking the row rhythm
- The running app preview uses the new primitives instead of raw preview spans for display and keys
- Tests cover the primary component contracts and pass alongside lint, typecheck, and build validation

## Out of Scope

- Rendering the full portrait keypad component abstraction
- Rendering the landscape scientific keypad
- Calculator state management or engine dispatch
- Keyboard support
