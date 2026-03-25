# Task PRD — P1-T4 Create calculator feature module boundaries

## Objective

Make the calculator feature boundary explicit at the package level. The repository already contains the calculator subfolders and most placeholder modules, so this task focuses on completing the top-level feature surface with root barrel files and verifying that the module layout stays cleanly separated for future engine, config, component, and style work.

This task should not add calculator behavior. It should only define a stable import surface and confirm the boundary structure is present.

## Deliverables

- `src/features/index.ts`
- `src/features/calculator/index.ts`
- Existing calculator submodule folders preserved and discoverable
- `SPECS/INPROGRESS/P1-T4_Validation_Report.md`

## Acceptance Criteria

- The top-level `src/features/` boundary exists as an importable module
- The calculator feature exposes a clear root barrel for future imports
- The calculator subfolders remain separated by concern
- No calculator logic is moved into the app shell
- Lint, test, typecheck, and build gates continue to pass

## Test-First Plan

1. Confirm the current feature-tree layout and identify missing root entrypoints.
2. Add the top-level barrel files for `src/features/` and `src/features/calculator/`.
3. Re-run lint, tests, typecheck, and build to ensure the structural additions do not change runtime behavior.

## Execution Plan

### Phase 1: Boundary audit

Inputs:
- existing `src/features/calculator/` directories and barrel files
- app shell imports

Outputs:
- list of missing root feature entrypoints

Verification:
- inspect the current tree and confirm the boundary modules that are absent

### Phase 2: Add barrels

Inputs:
- calculator submodule barrels
- feature directory layout

Outputs:
- `src/features/index.ts`
- `src/features/calculator/index.ts`

Verification:
- the feature tree can be imported from the root feature boundary

### Phase 3: Validate and report

Inputs:
- updated module boundary files

Outputs:
- validation report under `SPECS/INPROGRESS/`

Verification:
- `npm run lint`
- `npm run test -- --run`
- `npm run typecheck`
- `npm run build`

## Notes

- Keep this task focused on structure. Do not pull calculator behavior or presentation logic into the new barrel files.
- If the boundary files already re-export the expected modules, keep the exports minimal and stable rather than clever.
