# Task PRD - P2-T5 Implement parentheses handling and display formatting

## Objective

Finish the remaining Phase 2 engine work by adding a dedicated parentheses stack to the calculator reducer and extracting display formatting into a reusable helper. The current implementation already supports standard arithmetic, memory, scientific operations, constants, and scientific notation; this task closes the loop on grouped scientific expressions and keeps the UI free from formatting rules.

## Deliverables

- `src/features/calculator/model/calculatorEngine.ts`
- `src/features/calculator/lib/formatDisplay.ts`
- Updated reducer tests for grouped arithmetic and long-value display formatting
- `SPECS/INPROGRESS/P2-T5_Validation_Report.md`

## Acceptance Criteria

- Parentheses are supported and not treated as disabled placeholders
- Display formatting handles long values, decimals, and error tokens safely
- Formatting logic is isolated from React rendering logic

## Test-First Plan

1. Review the current reducer for where group actions and display formatting are currently stubbed or inlined.
2. Add focused tests for grouped arithmetic, nested parentheses, long numeric values, decimals, and the `Error` token.
3. Implement the smallest stack and formatter helpers needed by the new tests.
4. Re-run lint, tests, typecheck, and build.

## Execution Plan

### Phase 1: Parentheses behavior

Inputs:
- `calculatorEngine.ts`
- existing reducer tests

Outputs:
- a parentheses stack in reducer state
- grouped arithmetic test coverage

Verification:
- `npm run test -- --run`

### Phase 2: Display formatting helper

Inputs:
- display rendering code
- numeric formatting rules

Outputs:
- `src/features/calculator/lib/formatDisplay.ts`
- updated calculator shell to consume the shared formatter

Verification:
- `npm run test -- --run`

### Phase 3: Validation and report

Inputs:
- updated reducer, helper, and tests

Outputs:
- validation report under `SPECS/INPROGRESS/`

Verification:
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Notes

- Keep the scope limited to the calculator’s immediate-execution model; do not introduce a general expression editor.
- Any remaining visual polish or layout tuning belongs to later UI tasks.
