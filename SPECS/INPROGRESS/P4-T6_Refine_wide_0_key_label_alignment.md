# Task PRD — P4-T6 Refine wide `0` key label alignment

## Scope

Correct the optical alignment of the wide `0` key label so it lines up with the left digit column instead of appearing offset simply because the `0` button spans two columns. The fix should improve the shared content-alignment contract of calculator buttons rather than hardcoding a special-case visual hack that only works for the current preview.

## Deliverables

- Updated calculator button styling or markup that aligns standard and wide key labels through a shared internal spacing strategy
- Tests covering the alignment contract exposed by the button primitive
- Preview wiring updates if required to exercise the corrected alignment behavior

## Dependencies

- P3-T2 button primitive implementation

## Constraints

- No calculator engine logic
- No CSS-in-JS
- No Tailwind
- The fix must preserve centered labels for single-width buttons
- The wide `0` button must remain visually balanced as a pill while aligning its label with the left digit column
- Avoid one-off alignment values that cannot scale to later keypad composition work

## Execution Plan

1. Inspect the current `CalcButton` structure and identify why the wide button’s label drifts relative to the digit column.
2. Refine the button’s internal layout so standard buttons and wide buttons share a consistent content-alignment strategy.
3. Add or update tests to lock in the layout-facing state needed for the alignment contract.
4. Verify the preview visually in portrait mode and run the project quality gates.

## Acceptance Criteria

- The `0` label aligns optically with the left digit column, especially beneath the `1` key
- Single-width buttons keep their labels visually centered after the alignment fix
- The implementation uses a shared padding or content-alignment strategy instead of a `0`-only offset hack
- `npm run format`, `npm run lint`, `npm run test -- --run`, `npm run typecheck`, and `npm run build` all pass

## Out of Scope

- Full keypad composition
- Scientific landscape layout
- Calculator interaction or state logic
