# Task PRD — P3-T1 Define portrait, scientific, and `2nd` key metadata

## Scope

Create the calculator key-definition contract that describes the portrait keypad plus the landscape scientific keypad in both normal and `2nd` states. This task should replace ad hoc preview row literals with a reusable, typed, data-driven module that later keypad rendering and engine dispatch work can consume without embedding calculator layout details in React components.

## Deliverables

- `src/features/calculator/config/keyDefinitions.ts`
- tests covering the portrait and landscape row contracts plus the `2nd` mode label swaps
- updated calculator config exports
- app preview wiring updated to consume portrait metadata instead of local hard-coded rows

## Dependencies

- P1-T4 calculator feature module boundaries
- P3-T2 display and button primitives
- P2-T1 typed calculator contracts are not implemented yet, so this task must define a narrow UI-facing action identifier contract that can be aligned later

## Constraints

- No calculator engine implementation or arithmetic behavior in this task
- No viewport switching or full keypad component composition yet
- Metadata must stay serializable and data-driven rather than embedding JSX or component references
- The portrait layout must include only the standard keypad
- The landscape layouts must match the PRD row order exactly in both normal and `2nd` modes
- Metadata must capture visible label, semantic action identifier, visual variant, and layout span or wide-key behavior
- The `0` key must be expressible as a double-width pill key in portrait and landscape metadata

## Execution Plan

1. Define the key metadata types and action identifier unions needed for portrait, landscape, and `2nd` state rendering.
2. Encode the PRD row-by-row keypad layouts in a new config module with stable visual variants and wide-key metadata.
3. Export the new config module through the calculator config barrel and update the app preview to derive the portrait rows from metadata.
4. Add tests that validate portrait coverage, landscape row accuracy, `2nd` mode swaps, and operator/system variant assignments.
5. Run the project quality gates and confirm the portrait preview still renders through the shared metadata contract.

## Acceptance Criteria

- Portrait metadata contains only the standard keypad keys from PRD section 6.6
- Landscape metadata matches the PRD section 6.8 rows exactly for both normal and `2nd` modes
- Each key definition includes label, semantic action identifier, style variant, and layout span or wide-key metadata
- The config is exported for reuse by later keypad composition work
- Tests verify the critical row contracts and pass alongside lint, typecheck, and build validation

## Out of Scope

- Calculator state transition logic
- Scientific operation execution mapping beyond stable action identifiers
- Final portrait or landscape keypad component rendering
- Keyboard support
