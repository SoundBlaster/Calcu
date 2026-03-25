# Task PRD — P2-T1 Define typed calculator state and action contracts

## Scope

Define the shared calculator state and action contracts used by the engine, keypad metadata, and future memory/error handling work. The implementation expands the existing state model with memory and error metadata while keeping the current reducer shape intact.

## Deliverables

- `src/features/calculator/model/calculatorTypes.ts`
- Shared action-family type aliases for binary, unary, memory, mode, command, constant, digit, and group actions
- Expanded calculator state with memory and error metadata

## Dependencies

- P1-T4

## Constraints

- No calculator behavior changes beyond state contract alignment
- Keep the reducer and component imports compiling without introducing `any`
- Preserve the existing immediate-execution engine shape

## Acceptance Criteria

- State includes `displayValue`, `storedValue`, pending operator fields, memory value, angle mode, `secondMode`, and error metadata
- Shared action types distinguish unary operations, binary operations, memory actions, and layout-driven actions
- Type definitions compile cleanly

## Notes

- The task was implemented by expanding `calculatorTypes.ts` and lightly updating the reducer’s error-reset path to populate the new metadata fields.
