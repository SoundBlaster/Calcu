# Task PRD — P3-T5 Compose the calculator feature and viewport switching

## Scope

Compose a real `Calculator` feature component that owns calculator state, renders the existing display and keypad primitives, and adapts between portrait and landscape layouts without losing active state. This task should move the app beyond a static preview by routing button presses through a dedicated model layer, preserving display and UI mode across viewport changes, and integrating the calculator feature into the app shell.

## Deliverables

- `src/features/calculator/components/Calculator.tsx`
- `src/features/calculator/components/Calculator.module.css`
- model-layer files under `src/features/calculator/model/` for feature state and button dispatch
- feature exports and app integration updates so `App` renders the calculator feature
- tests covering standard interaction flow and viewport-mode preservation

## Dependencies

- P3-T3 portrait keypad layout
- P3-T4 landscape scientific keypad layout and preview state
- P2-T3 and P2-T5 are not archived yet, so this task will implement the minimum model behavior needed for standard calculator use and UI mode state without claiming full scientific-engine coverage

## Constraints

- Button presses must dispatch through a model/reducer layer rather than embedding arithmetic directly in React components
- Viewport changes must not reset display value or `2nd` mode
- The feature should remain usable in both portrait and landscape layouts
- Scientific layout should still render in landscape even where underlying advanced math remains outside this task’s scope
- Keep the integration maintainable so later Phase 2 engine tasks can expand the model rather than replace the UI surface

## Execution Plan

1. Define the calculator state and reducer primitives needed for standard arithmetic and UI mode toggles.
2. Create a `Calculator` component that owns viewport mode, display formatting, and key dispatch into the reducer.
3. Integrate portrait and landscape keypad rendering into the feature while preserving a single shared state model.
4. Add tests that verify standard button flow and state preservation across viewport changes.
5. Run the quality gates and verify the live feature in both portrait and landscape modes.

## Acceptance Criteria

- Viewport mode changes do not reset calculator state
- Button presses dispatch into the engine/model layer rather than embedding math logic in components
- The app renders a complete usable calculator in both portrait and landscape modes
- The calculator feature replaces the preview-only app shell
- Tests pass alongside lint, typecheck, and build validation

## Out of Scope

- Full scientific operation execution coverage
- Parentheses evaluation or expression-stack behavior
- Keyboard support
