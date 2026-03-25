# P4-T2: Write engine tests for standard and scientific behavior

## Goal

Add automated Vitest coverage for the calculator engine rules that define standard arithmetic, percent semantics, scientific operations, memory behavior, angle modes, `2nd` mode mapping, parentheses, and error handling.

## Scope

- Verify the reducer-backed engine across the existing calculator state transitions.
- Cover the critical PRD section 6 behaviors with deterministic test cases.
- Keep the tests focused on engine behavior and avoid React rendering concerns.

## Inputs

- Existing reducer and state contract under `src/features/calculator/model/`.
- Existing scientific and parentheses support already implemented in the engine.
- Vitest setup from `P1-T3`.

## Deliverables

- Engine test files under `src/features/calculator/model/` or `src/test/`.
- Validation report documenting the executed checks and test results.

## Acceptance Criteria

- Standard input rules are covered by automated tests.
- Percent examples and memory semantics are covered by automated tests.
- Scientific operations, `Rad`/`Deg`, and `2nd` mode behavior are covered by automated tests.
- Parentheses and error-state transitions are covered by automated tests.

## Dependencies

- P2-T3: Percent, memory, and error rules.
- P2-T4: Scientific unary and binary operations.
- P2-T5: Parentheses handling and display formatting.
- P1-T3: Vitest configuration and entrypoints.

## Notes

- Prefer small, explicit reducer tests that encode the PRD rules directly.
- Reuse the existing state reducer and helper functions rather than building a separate test harness.
