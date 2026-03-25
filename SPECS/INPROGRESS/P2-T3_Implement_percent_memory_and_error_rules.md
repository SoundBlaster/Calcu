# Task PRD - P2-T3 Implement percent, memory, and error rules

## Objective

Finish the calculator engine rules that sit between the standard arithmetic reducer and the later scientific features. The current code already has a percent branch and a generic error path, but this task must verify the behavior against the PRD, add the missing memory operations, and make domain errors stable and deterministic.

The implementation should stay inside the engine/model layer and keep the UI unaware of the rule details.

## Deliverables

- `src/features/calculator/model/calculatorEngine.ts`
- Updated reducer tests for percent, memory, and error transitions
- `SPECS/INPROGRESS/P2-T3_Validation_Report.md`

## Acceptance Criteria

- Percent matches the PRD examples for both standalone and pending-operator cases
- `mc`, `m+`, `m-`, and `mr` update and recall memory predictably
- Invalid operations enter `Error` and stay there until `AC`
- Error recovery restores a clean calculator state

## Test-First Plan

1. Audit the current reducer tests for memory and error coverage gaps.
2. Add focused tests for standalone percent, pending-operator percent, memory clear/add/subtract/recall, and invalid operations.
3. Patch the reducer only where the new tests expose a mismatch.
4. Re-run lint, tests, typecheck, and build.

## Execution Plan

### Phase 1: Behavior audit

Inputs:
- `calculatorEngine.ts`
- `calculatorTypes.ts`
- existing reducer tests

Outputs:
- gap list for percent, memory, and error handling

Verification:
- compare the current reducer against PRD sections 6.5 and 6.10

### Phase 2: Reducer coverage

Inputs:
- reducer behavior
- newly added tests

Outputs:
- reducer adjustments, if required
- regression coverage for memory and error paths

Verification:
- `npm run test -- --run`

### Phase 3: Validation and report

Inputs:
- updated reducer and tests

Outputs:
- validation report under `SPECS/INPROGRESS/`

Verification:
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Notes

- Keep scientific unary/binary work out of scope for this task.
- If the reducer already satisfies an acceptance criterion, prefer adding the regression test rather than changing behavior unnecessarily.
