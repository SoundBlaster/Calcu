# Task PRD — P1-T5 Define layout tokens and base styling contracts

## Scope

Create the shared visual token system that the calculator UI will use for sizing, spacing, typography, radii, color roles, and viewport-mode breakpoints. This task should convert the existing hardcoded preview shell into a token-driven foundation so later component tasks can build real `Display`, `CalcButton`, and keypad layouts without re-deciding visual constants.

## Deliverables

- `src/features/calculator/config/layoutTokens.ts` with typed layout and visual token definitions
- A shared calculator theme stylesheet for CSS custom properties used by the app shell
- Refactored preview styles that consume the shared token layer instead of hardcoded values
- Updated config/style barrel exports as needed for later task reuse

## Dependencies

- P1-T4 module boundaries

## Constraints

- No calculator arithmetic or state-transition logic in this task
- No CSS-in-JS
- No Tailwind
- Tokens must support both circular keys and the double-width `0` pill key
- Portrait and landscape breakpoints must be explicit and reusable
- Color roles must stay aligned with the PRD calculator hierarchy

## Execution Plan

1. Define typed tokens for breakpoints, button geometry, display sizing, spacing, radii, and color roles.
2. Add a shared CSS theme layer that exposes those visual contracts through calculator-specific custom properties.
3. Refactor the existing preview shell and global styling to consume the token variables.
4. Verify the tokenized shell still renders a stable full-viewport calculator preview in portrait and landscape proportions.

## Acceptance Criteria

- `layoutTokens.ts` centralizes button dimensions, gap scales, radii, color roles, and portrait/landscape breakpoints
- A shared CSS token layer exists and can be consumed by current and future calculator UI styles
- The `0` key and circular key geometry are supported without ad hoc per-button sizing
- The existing preview shell uses the token layer rather than repeating raw visual constants
- `npm run lint`, `npm run test -- --run`, `npm run typecheck`, and `npm run build` all pass

## Out of Scope

- Implementing calculator engine behavior
- Building final `Display` and `CalcButton` component primitives
- Rendering the full scientific landscape keypad
- Keyboard support or interaction logic
