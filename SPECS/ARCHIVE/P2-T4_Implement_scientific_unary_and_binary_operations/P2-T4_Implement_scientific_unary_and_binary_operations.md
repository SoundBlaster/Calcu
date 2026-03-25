# Task PRD - P2-T4 Implement scientific unary and binary operations

## Objective

Extend the calculator engine with the scientific operations required by the landscape layout and `2nd` mode. The current reducer handles the standard arithmetic flow, percent, memory, and errors, but it does not yet execute the scientific keys exposed by the key metadata.

This task should keep the engine deterministic, testable, and isolated from React rendering. Any reusable math logic should live in `src/features/calculator/lib/` so later parentheses and formatting work can build on it cleanly.

## Deliverables

- `src/features/calculator/model/calculatorEngine.ts`
- New or updated helpers under `src/features/calculator/lib/`
- Updated reducer tests for scientific unary, binary, constants, and mode-aware mappings
- `SPECS/INPROGRESS/P2-T4_Validation_Report.md`

## Acceptance Criteria

- Unary operations such as square, cube, reciprocal, roots, factorial, exponentials, logs, trig, hyperbolic trig, and inverse trig execute against the current display value
- Binary scientific operators such as power and root resolve through the immediate-execution model
- `Rad` and `Deg` alter trig and inverse trig math correctly
- `2nd` mode maps the alternate scientific labels to the right actions
- Constants and `EE` integrate with active display entry rules without breaking standard input

## Test-First Plan

1. Review current reducer and key-definition coverage for scientific actions.
2. Add focused tests for direct unary execution, binary scientific chaining, angle-mode-sensitive trig, constants, and `2nd` remapping.
3. Introduce math helpers only where they simplify correctness or reuse.
4. Re-run lint, tests, typecheck, and build.

## Execution Plan

### Phase 1: Coverage map

Inputs:
- `calculatorEngine.ts`
- `calculatorTypes.ts`
- `keyDefinitions.ts`
- existing calculator tests

Outputs:
- list of unhandled scientific actions and required math helpers

Verification:
- compare reducer support against PRD sections 6.7, 6.8, and 6.12

### Phase 2: Scientific reducer implementation

Inputs:
- scientific action map
- helper math functions

Outputs:
- reducer support for unary and binary scientific operations
- regression tests for supported formulas and mode behavior

Verification:
- `npm run test -- --run`

### Phase 3: Validation and report

Inputs:
- updated reducer, helpers, and tests

Outputs:
- validation report under `SPECS/INPROGRESS/`

Verification:
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Notes

- Keep parentheses handling for P2-T5; do not build a general expression parser here.
- If any key labels already exist in the metadata but are not meant to execute yet, document the gap in tests instead of silently wiring them to a placeholder.

---
**Archived:** 2026-03-25
**Verdict:** PASS
