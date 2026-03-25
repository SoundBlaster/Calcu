# Task PRD — P2-T2 Implement standard arithmetic state transitions

## Objective

Lock down the immediate-execution calculator engine for standard arithmetic input. The reducer already exists in the tree, so this task focuses on verifying and tightening the transition rules for digits, decimal entry, clear, sign toggle, binary operators, equals, and repeated equals.

The implementation should keep the logic isolated from React state and preserve the shared state contract introduced in P2-T1.

## Deliverables

- `src/features/calculator/model/calculatorEngine.ts`
- Updated reducer tests covering the standard arithmetic input path
- `SPECS/INPROGRESS/P2-T2_Validation_Report.md`

## Acceptance Criteria

- Digits append and replace display correctly across fresh input, operator chaining, and resolved results
- Decimal entry is stable and does not produce duplicate decimal points
- All-clear resets the calculator to the initial state
- Sign toggle and backspace remain stable in the standard input flow
- Binary operators and equals follow the immediate-execution model
- Repeated equals reuses the last resolved binary operand consistently

## Test-First Plan

1. Review the current reducer tests and identify any missing standard-input edge cases.
2. Add or adjust tests for decimal entry, clear/reset, sign toggling, operator chaining, and repeated equals.
3. Make the smallest reducer fix required by any failing test.
4. Re-run lint, tests, typecheck, and build.

## Execution Plan

### Phase 1: Behavior audit

Inputs:
- `calculatorEngine.ts`
- existing reducer tests

Outputs:
- gap list for standard arithmetic transitions

Verification:
- inspect current reducer behavior against the PRD’s immediate-execution rules

### Phase 2: Transition validation

Inputs:
- reducer behavior and current tests

Outputs:
- strengthened unit tests for the standard input path
- reducer adjustments if needed

Verification:
- `npm run test -- --run`

### Phase 3: Validation and report

Inputs:
- updated reducer or tests

Outputs:
- validation report under `SPECS/INPROGRESS/`

Verification:
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Notes

- Keep the task limited to standard arithmetic transitions. Percent, memory, and scientific operations are separate tasks.
- If the reducer already satisfies the contract, prefer adding a regression test rather than changing behavior for its own sake.
